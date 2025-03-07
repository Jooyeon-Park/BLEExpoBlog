import React, { FC, useCallback, useState, useEffect } from "react";
import {
  FlatList,
  ListRenderItemInfo,
  Modal,
  SafeAreaView,
  Text,
  StyleSheet,
  TouchableOpacity,
  PermissionsAndroid,
} from "react-native";
import { Device, BleManager, BleError } from "react-native-ble-plx";

type DeviceModalListItemProps = {
  item: ListRenderItemInfo<Device>;
  connectToPeripheral: (device: Device) => Promise<Device>;
  closeModal: () => void;
};

type DeviceModalProps = {
  visible: boolean;
  connectToPeripheral: (device: Device) => Promise<Device>;
  closeModal: () => void;
};

const DeviceModalListItem: FC<DeviceModalListItemProps> = (props) => {
  const { item, connectToPeripheral, closeModal } = props;

  const connectAndCloseModal = useCallback(async () => {
    try {
      const connectedDevice = await connectToPeripheral(item.item);
      console.log(
        "Connected to device:",
        connectedDevice.name ?? connectedDevice.localName
      );

      // Example: Read a characteristic or perform an action
      // Replace 'serviceUUID' and 'characteristicUUID' with actual UUIDs
      const services =
        await connectedDevice.discoverAllServicesAndCharacteristics();
      const characteristics = await services.characteristicsForService(
        "serviceUUID"
      );
      const characteristic = characteristics.find(
        (c) => c.uuid === "characteristicUUID"
      );

      if (characteristic) {
        const response = await characteristic.read();
        console.log("Received response:", response.value);
      }

      closeModal();
    } catch (error) {
      console.error("Failed to connect or communicate:", error);
    }
  }, [closeModal, connectToPeripheral, item.item]);

  return (
    <TouchableOpacity
      onPress={connectAndCloseModal}
      style={modalStyle.ctaButton}
    >
      <Text style={modalStyle.ctaButtonText}>
        {item.item.name ?? item.item.localName ?? "Unnamed Device"}
      </Text>
      <Text style={modalStyle.deviceTypeText}>ID: {item.item.id}</Text>
      <Text style={modalStyle.deviceTypeText}>
        RSSI: {item.item.rssi ?? "N/A"}
      </Text>
    </TouchableOpacity>
  );
};

const DeviceModal: FC<DeviceModalProps> = (props) => {
  const { visible, connectToPeripheral, closeModal } = props;
  const [scannedDevices, setScannedDevices] = useState<Device[]>([]);
  const manager = new BleManager();
  const loggedDeviceIds = new Set<string>();

  useEffect(() => {
    const requestPermissions = async () => {
      try {
        const granted = await PermissionsAndroid.request(
          PermissionsAndroid.PERMISSIONS.ACCESS_FINE_LOCATION,
          {
            title: "Location Permission",
            message:
              "This app needs access to your location for Bluetooth scanning.",
            buttonNeutral: "Ask Me Later",
            buttonNegative: "Cancel",
            buttonPositive: "OK",
          }
        );
        if (granted !== PermissionsAndroid.RESULTS.GRANTED) {
          console.log("Location permission denied");
        }
      } catch (err) {
        console.warn(err);
      }
    };

    requestPermissions();

    if (visible) {
      const subscription = manager.onStateChange((state) => {
        if (state === "PoweredOn") {
          scanForDevices();
          subscription.remove();
        } else {
          console.log("Bluetooth state is:", state);
        }
      }, true);

      return () => {
        manager.stopDeviceScan();
      };
    }
  }, [manager, visible]);

  const scanForDevices = () => {
    manager.startDeviceScan(null, null, (error, device) => {
      if (error) {
        console.error("Scan error:", error);
        return;
      }

      if (device && device.isConnectable) {
        if (!loggedDeviceIds.has(device.id)) {
          console.log(
            "Discovered device:",
            device.name ?? device.localName ?? "Unnamed Device",
            "ID:",
            device.id,
            "RSSI:",
            device.rssi
          );
          loggedDeviceIds.add(device.id);
        }

        setScannedDevices((prevDevices) => {
          const updatedDevices = [...prevDevices];
          if (!updatedDevices.find((d) => d.id === device.id)) {
            updatedDevices.push(device);
          }
          // Sort devices by RSSI in descending order
          return updatedDevices.sort((a, b) => (b.rssi ?? 0) - (a.rssi ?? 0));
        });
      }
    });
  };

  const renderDeviceModalListItem = useCallback(
    (item: ListRenderItemInfo<Device>) => {
      return (
        <DeviceModalListItem
          item={item}
          connectToPeripheral={connectToPeripheral}
          closeModal={closeModal}
        />
      );
    },
    [closeModal, connectToPeripheral]
  );

  return (
    <Modal
      style={modalStyle.modalContainer}
      animationType="slide"
      transparent={false}
      visible={visible}
    >
      <SafeAreaView style={modalStyle.modalTitle}>
        <Text style={modalStyle.modalTitleText}>
          Tap on a device to connect
        </Text>
        <FlatList
          contentContainerStyle={modalStyle.modalFlatlistContiner}
          data={scannedDevices}
          renderItem={renderDeviceModalListItem}
          keyExtractor={(item) => item.id}
          style={{ flexGrow: 1 }}
        />
      </SafeAreaView>
    </Modal>
  );
};

const modalStyle = StyleSheet.create({
  modalContainer: {
    flex: 1,
    backgroundColor: "#f2f2f2",
  },
  modalFlatlistContiner: {
    flexGrow: 1,
    justifyContent: "center",
  },
  modalCellOutline: {
    borderWidth: 1,
    borderColor: "black",
    alignItems: "center",
    marginHorizontal: 20,
    paddingVertical: 15,
    borderRadius: 8,
  },
  modalTitle: {
    flex: 1,
    backgroundColor: "#f2f2f2",
  },
  modalTitleText: {
    marginTop: 40,
    fontSize: 30,
    fontWeight: "bold",
    marginHorizontal: 20,
    textAlign: "center",
  },
  ctaButton: {
    backgroundColor: "#FF6060",
    justifyContent: "center",
    alignItems: "center",
    height: 50,
    marginHorizontal: 20,
    marginBottom: 5,
    borderRadius: 8,
  },
  ctaButtonText: {
    fontSize: 18,
    fontWeight: "bold",
    color: "white",
  },
  deviceTypeText: {
    fontSize: 14,
    color: "gray",
  },
});

export default DeviceModal;
