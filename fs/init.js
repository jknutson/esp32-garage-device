/*
 * Copyright (c) 2014-2017 Cesanta Software Limited
 * All rights reserved
 *
 * This example demonstrates how to use mJS Arduino OneWire
 * library API to get data from DS18B20 temperature sensors.
 * Datasheet: http://datasheets.maximintegrated.com/en/ds/DS18B20.pdf
 */

load('api_arduino_onewire.js');
load('api_timer.js');
load('api_gpio.js');
load('api_mqtt.js');
load('ds18b20.js');

let topic = 'projects/keg-iot/topics/events';
let timeFormat = '%FT%T%z';
let doorPin = 12;
let isConnected = false;
GPIO.set_mode(doorPin, GPIO.MODE_INPUT);
GPIO.set_pull(doorPin, GPIO.PULL_DOWN);

// Initialize OneWire library
let ow = OneWire.create(14 /* OneWire pin */);

// Number of sensors found on the 1-Wire bus
let n = 0;
// Sensors addresses
let rom = ['01234567'];

// Search for sensors
let searchSens = function() {
  let i = 0;
  // Setup the search to find the device type on the next call
  // to search() if it is present.
  ow.target_search(DEVICE_FAMILY.DS18B20);

  while (ow.search(rom[i], 0/* Normal search mode */) === 1) {
    // If no devices of the desired family are currently on the bus, 
    // then another type will be found. We should check it.
    if (rom[i][0].charCodeAt(0) !== DEVICE_FAMILY.DS18B20) {
      break;
    }
    // Sensor found
    print('Sensor#', i, 'address:', toHexStr(rom[i]));
    rom[++i] = '01234567';
  }
  return i;
};

function publishData(data) {
  let ok = MQTT.pub(topic, data);
  if (ok) {
    print('Published');
  } else {
    print('Error publishing');
  }
}

let readTemp = function() {
  if (n === 0) {
    if ((n = searchSens()) === 0) {
      print('No device found');
    }
  }

  for (let i = 0; i < n; i++) {
    let t = getTemp(ow, rom[i]);
    if (isNaN(t)) {
      print('No device found');
      return false;
    } else {
      print('Sensor#', i, 'Temperature:', t, '*C');
      return [i, t];
    }
  }
};

// TODO: try handlers again?
let readDoor = function() {
  let doorStatus = GPIO.read(doorPin);
  return [doorPin, doorStatus];
};

Timer.set(5000 /* milliseconds */, true /* repeat */, function() {
  let timestamp = Timer.fmt(timeFormat, Timer.now());
  let rt = readTemp();
  if (rt) {
    print(rt);
    let tempPayload = JSON.stringify({
      timestamp: timestamp,
      data: {
        sensor: rt[0],
        temperature_c: rt[1]
      }
    });
    print('temp payload: ', tempPayload);
    let pub = publishData(tempPayload);
    print('published: ', pub);
  }

  let rd = readDoor();
  print(rd);

  let doorPayload = JSON.stringify({
    timestamp: timestamp,
    data: {
      pin: rd[0],
      doorStatus: rd[1]
    }
  });
  print('door payload: ', doorPayload);
  let pub = publishData(doorPayload);
  print('published: ', pub);

}, null);

