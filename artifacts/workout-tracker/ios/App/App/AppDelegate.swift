import UIKit
import Capacitor
import HealthKit

@UIApplicationMain
class AppDelegate: UIResponder, UIApplicationDelegate {

    var window: UIWindow?

    func application(_ application: UIApplication, didFinishLaunchingWithOptions launchOptions: [UIApplication.LaunchOptionsKey: Any]?) -> Bool {
        return true
    }

    func applicationWillResignActive(_ application: UIApplication) {
    }

    func applicationDidEnterBackground(_ application: UIApplication) {
    }

    func applicationWillEnterForeground(_ application: UIApplication) {
    }

    func applicationDidBecomeActive(_ application: UIApplication) {
    }

    func applicationWillTerminate(_ application: UIApplication) {
    }

    func application(_ app: UIApplication, open url: URL, options: [UIApplication.OpenURLOptionsKey: Any] = [:]) -> Bool {
        return ApplicationDelegateProxy.shared.application(app, open: url, options: options)
    }

    func application(_ application: UIApplication, continue userActivity: NSUserActivity, restorationHandler: @escaping ([UIUserActivityRestoring]?) -> Void) -> Bool {
        return ApplicationDelegateProxy.shared.application(application, continue: userActivity, restorationHandler: restorationHandler)
    }

}

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
            call.reject("HealthKit not available")
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
            call.reject("HealthKit not available")
            return
        }
        guard let startIso = call.getString("startDate"),
              let endIso = call.getString("endDate"),
              let calories = call.getDouble("calories") else {
            call.reject("Missing required parameters")
            return
        }
        let formatter = ISO8601DateFormatter()
        guard let startDate = formatter.date(from: startIso),
              let endDate = formatter.date(from: endIso) else {
            call.reject("Invalid date format")
            return
        }
        let energyBurned = HKQuantity(unit: .kilocalorie(), doubleValue: calories)
        let workout = HKWorkout(
            activityType: .traditionalStrengthTraining,
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
