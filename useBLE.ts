/* eslint-disable no-bitwise */
import { useState } from "react";
import { PermissionsAndroid, Platform } from "react-native";
import * as ExpoDevice from "expo-device";
import {
  BleError,
  BleManager,
  Characteristic,
  Device,
} from "react-native-ble-plx";

// Create a single BleManager instance
const bleManager = new BleManager();

function useBLE() {
  const [allDevices, setAllDevices] = useState<Device[]>([]);
  const [connectedDevice, setConnectedDevice] = useState<Device | null>(null);
  const [color, setColor] = useState("white"); // Keep this for UI feedback

  // Request permissions for Android 12+ (API level 31+)
  const requestAndroid31Permissions = async () => {
    const bluetoothScanPermission = await PermissionsAndroid.request(
      PermissionsAndroid.PERMISSIONS.BLUETOOTH_SCAN,
      {
        title: "Bluetooth Scan Permission",
        message: "This app needs permission to scan for Bluetooth devices",
        buttonPositive: "OK",
      }
    );
    const bluetoothConnectPermission = await PermissionsAndroid.request(
      PermissionsAndroid.PERMISSIONS.BLUETOOTH_CONNECT,
      {
        title: "Bluetooth Connect Permission",
        message: "This app needs permission to connect to Bluetooth devices",
        buttonPositive: "OK",
      }
    );
    const fineLocationPermission = await PermissionsAndroid.request(
      PermissionsAndroid.PERMISSIONS.ACCESS_FINE_LOCATION,
      {
        title: "Location Permission",
        message: "Bluetooth scanning requires location permission",
        buttonPositive: "OK",
      }
    );

    return (
      bluetoothScanPermission === "granted" &&
      bluetoothConnectPermission === "granted" &&
      fineLocationPermission === "granted"
    );
  };

  // Request appropriate permissions based on platform and API level
  const requestPermissions = async () => {
    if (Platform.OS === "android") {
      if ((ExpoDevice.platformApiLevel ?? -1) < 31) {
        const granted = await PermissionsAndroid.request(
          PermissionsAndroid.PERMISSIONS.ACCESS_FINE_LOCATION,
          {
            title: "Location Permission",
            message: "Bluetooth scanning requires location permission",
            buttonPositive: "OK",
          }
        );
        return granted === PermissionsAndroid.RESULTS.GRANTED;
      } else {
        return await requestAndroid31Permissions();
      }
    } else {
      // iOS doesn't require runtime permissions for Bluetooth
      return true;
    }
  };

  // Connect to a device and discover services
  const connectToDevice = async (device: Device) => {
    try {
      console.log(`Connecting to device: ${device.id}`);
      const deviceConnection = await bleManager.connectToDevice(device.id);
      setConnectedDevice(deviceConnection);

      console.log("Discovering services and characteristics...");
      await deviceConnection.discoverAllServicesAndCharacteristics();

      // Stop scanning once connected
      bleManager.stopDeviceScan();

      console.log("Connected successfully");
      setColor("#00FF00"); // Green to indicate successful connection

      return deviceConnection;
    } catch (e) {
      console.log("FAILED TO CONNECT", e);
      setColor("#FF0000"); // Red to indicate connection failure
      throw e;
    }
  };

  // Check if a device is already in our list
  const isDuplicateDevice = (devices: Device[], nextDevice: Device) =>
    devices.findIndex((device) => nextDevice.id === device.id) > -1;

  // Scan for all available Bluetooth devices
  const scanForPeripherals = () => {
    console.log("Starting device scan...");
    setAllDevices([]); // Clear previous devices

    bleManager.startDeviceScan(null, null, (error, device) => {
      if (error) {
        console.log("Scan error:", error);
        return;
      }

      if (device && device.isConnectable) {
        console.log(
          `Found device: ${device.name || device.localName || "Unnamed"}`
        );

        setAllDevices((prevState: Device[]) => {
          if (!isDuplicateDevice(prevState, device)) {
            // Sort by RSSI (signal strength)
            const updatedDevices = [...prevState, device];
            return updatedDevices.sort((a, b) => (b.rssi ?? 0) - (a.rssi ?? 0));
          }
          return prevState;
        });
      }
    });
  };

  // Disconnect from the current device
  const disconnectFromDevice = async () => {
    if (connectedDevice) {
      try {
        await bleManager.cancelDeviceConnection(connectedDevice.id);
        setConnectedDevice(null);
        setColor("white");
        console.log("Disconnected from device");
      } catch (error) {
        console.log("Error disconnecting:", error);
      }
    }
  };

  return {
    connectToDevice,
    disconnectFromDevice,
    allDevices,
    connectedDevice,
    color,
    requestPermissions,
    scanForPeripherals,
  };
}

export default useBLE;
