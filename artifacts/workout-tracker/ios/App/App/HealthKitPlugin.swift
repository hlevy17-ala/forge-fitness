import Foundation
import Capacitor
import HealthKit

@objc(HealthKitPlugin)
public class HealthKitPlugin: CAPPlugin, CAPBridgedPlugin {
    public let identifier = "HealthKitPlugin"
    public let jsName = "HealthKit"
    public let pluginMethods: [CAPPluginMethod] = [
        CAPPluginMethod(name: "requestAuthorization", returnType: CAPPluginReturnPromise),
        CAPPluginMethod(name: "saveWorkout", returnType: CAPPluginReturnPromise),
        CAPPluginMethod(name: "readUserProfile", returnType: CAPPluginReturnPromise),
        CAPPluginMethod(name: "readHeartRateSamples", returnType: CAPPluginReturnPromise),
    ]

    private let healthStore = HKHealthStore()

    @objc func requestAuthorization(_ call: CAPPluginCall) {
        guard HKHealthStore.isHealthDataAvailable() else {
            call.reject("HealthKit is not available on this device")
            return
        }

        let typesToWrite: Set<HKSampleType> = [
            HKObjectType.workoutType(),
            HKQuantityType.quantityType(forIdentifier: .activeEnergyBurned)!
        ]

        let typesToRead: Set<HKObjectType> = [
            HKQuantityType.quantityType(forIdentifier: .heartRate)!,
            HKObjectType.characteristicType(forIdentifier: .dateOfBirth)!,
            HKObjectType.characteristicType(forIdentifier: .biologicalSex)!
        ]

        healthStore.requestAuthorization(toShare: typesToWrite, read: typesToRead) { success, error in
            if let error = error {
                call.reject(error.localizedDescription)
                return
            }
            call.resolve(["authorized": success])
        }
    }

    @objc func readUserProfile(_ call: CAPPluginCall) {
        guard HKHealthStore.isHealthDataAvailable() else {
            call.resolve(["age": -1, "biologicalSex": "unknown"])
            return
        }

        var age = -1
        var sex = "unknown"

        if let dob = try? healthStore.dateOfBirthComponents(),
           let birthYear = dob.year {
            let currentYear = Calendar.current.component(.year, from: Date())
            age = currentYear - birthYear
        }

        if let bioSex = try? healthStore.biologicalSex() {
            switch bioSex.biologicalSex {
            case .male:   sex = "male"
            case .female: sex = "female"
            default:      sex = "unknown"
            }
        }

        call.resolve(["age": age, "biologicalSex": sex])
    }

    @objc func readHeartRateSamples(_ call: CAPPluginCall) {
        guard HKHealthStore.isHealthDataAvailable() else {
            call.resolve(["avgHeartRate": -1])
            return
        }

        guard let startIso = call.getString("startDate"),
              let endIso   = call.getString("endDate") else {
            call.resolve(["avgHeartRate": -1])
            return
        }

        let formatter = ISO8601DateFormatter()
        formatter.formatOptions = [.withInternetDateTime, .withFractionalSeconds]
        guard let startDate = formatter.date(from: startIso),
              let endDate   = formatter.date(from: endIso) else {
            call.resolve(["avgHeartRate": -1])
            return
        }

        let hrType    = HKQuantityType.quantityType(forIdentifier: .heartRate)!
        let predicate = HKQuery.predicateForSamples(withStart: startDate, end: endDate, options: .strictStartDate)

        let query = HKSampleQuery(
            sampleType: hrType,
            predicate: predicate,
            limit: HKObjectQueryNoLimit,
            sortDescriptors: nil
        ) { _, results, _ in
            guard let samples = results as? [HKQuantitySample], !samples.isEmpty else {
                call.resolve(["avgHeartRate": -1])
                return
            }
            let unit   = HKUnit(from: "count/min")
            let total  = samples.reduce(0.0) { $0 + $1.quantity.doubleValue(for: unit) }
            let avgHR  = total / Double(samples.count)
            call.resolve(["avgHeartRate": avgHR])
        }

        healthStore.execute(query)
    }

    @objc func saveWorkout(_ call: CAPPluginCall) {
        guard HKHealthStore.isHealthDataAvailable() else {
            call.reject("HealthKit is not available")
            return
        }

        guard let startIso = call.getString("startDate"),
              let endIso   = call.getString("endDate"),
              let calories = call.getDouble("calories") else {
            call.reject("Missing required parameters: startDate, endDate, calories")
            return
        }

        let formatter = ISO8601DateFormatter()
        formatter.formatOptions = [.withInternetDateTime, .withFractionalSeconds]
        guard let startDate = formatter.date(from: startIso),
              let endDate   = formatter.date(from: endIso) else {
            call.reject("Invalid date format — use ISO 8601")
            return
        }

        let activityTypeStr = call.getString("activityType") ?? "strength"
        let activityType: HKWorkoutActivityType
        switch activityTypeStr {
        case "outdoor_run": activityType = .running
        case "treadmill":   activityType = .running
        case "bike":        activityType = .cycling
        case "elliptical":  activityType = .elliptical
        default:            activityType = .traditionalStrengthTraining
        }

        let energyBurned = HKQuantity(unit: .kilocalorie(), doubleValue: calories)
        let workout = HKWorkout(
            activityType: activityType,
            start: startDate,
            end: endDate,
            duration: endDate.timeIntervalSince(startDate),
            totalEnergyBurned: energyBurned,
            totalDistance: nil,
            metadata: nil
        )

        healthStore.save(workout) { success, error in
            if let error = error {
                call.reject(error.localizedDescription)
                return
            }
            call.resolve(["saved": success])
        }
    }
}
