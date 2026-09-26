#include "comp_ble.h"

#include <BLEDevice.h>
#include <BLEServer.h>
#include <BLE2902.h>

/*
* Bluetooth LE: the ESP32 advertises as "FarmHand" and notifies one short JSON reading a second
* on BLE_READING_UUID (tools/sensors_live.py subscribes with bleak):
*   {"ms":..,"a":3262,"ap":7.3,"b":1617,"bp":94.2,"t":[20.44,20.50]}   (t: null = probe dropped off)
* Short keys keep it inside one notification.
*/

static BLECharacteristic *reading = nullptr;
static bool connected = false;

class ServerCallbacks : public BLEServerCallbacks
{
    void onConnect(BLEServer *server) override
    {
        connected = true;
    }

    void onDisconnect(BLEServer *server) override
    {
        connected = false;
        BLEDevice::startAdvertising();          /* let the laptop reconnect */
    }
};

StatusCode_e    BLE_init(void)
{
    BLEDevice::init(BLE_NAME);
    BLEDevice::setMTU(247);

    BLEServer *server = BLEDevice::createServer();
    server->setCallbacks(new ServerCallbacks());

    BLEService *service = server->createService(BLE_SERVICE_UUID);
    reading = service->createCharacteristic(BLE_READING_UUID,
                                            BLECharacteristic::PROPERTY_READ | BLECharacteristic::PROPERTY_NOTIFY);
    reading->addDescriptor(new BLE2902());
    service->start();

    BLEAdvertising *adv = BLEDevice::getAdvertising();
    adv->addServiceUUID(BLE_SERVICE_UUID);
    adv->setScanResponse(true);
    BLEDevice::startAdvertising();

    return STATUS_OK;
}

StatusCode_e    BLE_send(const SoilReading_t *soil, const TempReading_t *temp)
{
    char msg[160];
    int n = snprintf(msg, sizeof(msg), "{\"ms\":%lu,\"a\":%d,\"ap\":%.1f,\"b\":%d,\"bp\":%.1f,\"t\":[",
                     millis(), soil->raw[0], soil->pct[0], soil->raw[1], soil->pct[1]);
    for (int i = 0; i < temp->count && n < (int)sizeof(msg) - 12; i++)
    {
        if (temp->ok[i])
        {
            n += snprintf(msg + n, sizeof(msg) - n, "%s%.2f", i ? "," : "", temp->celsius[i]);
        }
        else
        {
            n += snprintf(msg + n, sizeof(msg) - n, "%snull", i ? "," : "");
        }
    }
    snprintf(msg + n, sizeof(msg) - n, "]}");

    reading->setValue((uint8_t *)msg, strlen(msg));
    if (connected)
    {
        reading->notify();
    }

    return STATUS_OK;
}

bool    BLE_connected(void)
{
    return connected;
}