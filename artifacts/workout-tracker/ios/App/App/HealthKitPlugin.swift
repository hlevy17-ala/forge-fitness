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

        healthStore.requestAuthorization(toShare: typesToWrite, read: nil) { success, error in
            if let error = error {
                call.reject(error.localizedDescription)
                return
            }
            call.resolve(["authorized": success])
        }
    }

    @objc func saveWorkout(_ call: CAPPluginCall) {
        guard HKHealthStore.isHealthDataAvailable() else {
            call.reject("HealthKit is not available")
            return
        }

        guard let startIso = call.getString("startDate"),
              let endIso = call.getString("endDate"),
              let calories = call.getDouble("calories") else {
            call.reject("Missing required parameters: startDate, endDate, calories")
            return
        }

        let formatter = ISO8601DateFormatter()
        formatter.formatOptions = [.withInternetDateTime, .withFractionalSeconds]
        guard let startDate = formatter.date(from: startIso),
              let endDate = formatter.date(from: endIso) else {
            call.reject("Invalid date format — use ISO 8601")
            return
        }

        let activityTypeStr = call.getString("activityType") ?? "strength"
        let activityType: HKWorkoutActivityType
        switch activityTypeStr {
        case "outdoor_run": activityType = .running
        case "treadmill": activityType = .running
        case "bike": activityType = .cycling
        case "elliptical": activityType = .elliptical
        default: activityType = .traditionalStrengthTraining
        }

        let energyBurned = HKQuantity(unit: .kilocalorie(), doubleValue: calories)
        let workout = HKWorkout(
            activityType: activityType,
            start: startDate,
            end: endDate,
            duration: endDate.timeIntervalSince(startDate),
            totalEnergyBurned: energyBurned,
            totalDistance: nil,
            metadata: [HKMetadataKeyWasUserEntered: true]
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
