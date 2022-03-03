/*
 * *******************************************************************************
 *   Copyright (c) 2019 Edgeworx, Inc.
 *
 *   This program and the accompanying materials are made available under the
 *   terms of the Eclipse Public License v. 2.0 which is available at
 *   http://www.eclipse.org/legal/epl-2.0
 *
 *   SPDX-License-Identifier: EPL-2.0
 * *******************************************************************************
 */

/*
* AUTHORS:
* With <3 from KPHPK
*/

const ioFogClient = require('@iofog/nodejs-sdk')
const request = require('request')

const LOCAL_NAME_PREFIX = 'RHYTHM+'
const INFOTYPE = 'heartrate'
const INFOFORMAT = 'utf-8/json'

let currentConfig = { 'test_mode': true, 'data_label': 'Anonymous Person' }
let deviceMac = ''
let notifyURL = ''

// Quick JSON logger
const jsonLogger = (logger, level) => (...args) => {
  const message = args.map(arg => typeof arg === typeof {} ? JSON.stringify(arg) : arg.toString()).join(' ')
  logger({ time: Date.now(), level, message })
}

console.error = jsonLogger(console.error, 'error')
console.info = jsonLogger(console.info, 'info')
console.debug = jsonLogger(console.debug, 'debug')
console.warn = jsonLogger(console.warn, 'warn')

ioFogClient.init('iofog', 54321, null,
  function heartRateMain () {
    // first thing first is to get config from ioFog
    fetchConfig()
    ioFogClient.wsControlConnection(
      {
        'onNewConfigSignal':
                    function onNewConfigSignal () {
                      // upon receiving signal about new config available -> go get it
                      fetchConfig()
                    },
        'onError':
                    function onControlSocketError (error) {
                      console.error('There was an error with Control WebSocket connection to ioFog: ', error)
                    }
      }
    )
    ioFogClient.wsMessageConnection(
      function (ioFogClient) { /* don't need to do anything on opened Message Socket */
      },
      {
        'onMessages':
                    function onMessagesSocket (messages) {
                      // Do nothing - this microservice does not respond to incoming data
                    },
        'onMessageReceipt':
                    function (messageId, timestamp) { /* we received the receipt for posted msg */
                    },
        'onError':
                    function onMessageSocketError (error) {
                      console.error('There was an error with Message WebSocket connection to ioFog: ', error)
                    }
      }
    )
  }
)

function fetchConfig () {
  console.info('Reading config')
  ioFogClient.getConfig(
    {
      'onBadRequest':
                function onConfigBadRequest (errorMsg) {
                  console.error('There was an error in request for getting config from the local API: ', errorMsg)
                },
      'onNewConfig':
                function onConfig (config) {
                  try {
                    if (config) {
                      if (JSON.stringify(config) !== JSON.stringify(currentConfig)) {
                        currentConfig = config
                      }
                    }
                  } catch (error) {
                    console.error('Couldn\'t stringify Config JSON: ', error)
                  }
                },
      'onError':
                function onConfigError (error) {
                  console.error('There was an error getting config from the local API: ', error)
                }
    }
  )
}

function runProcess () {
  console.info('Retrieving heart rate sensor reading')

  // Check if we are in test mode. If so, then skip doing any real work and send a randomly generated heart rate value with the proper flags
  if (currentConfig.test_mode) {
    var jsonOut = {}
    jsonOut.device_connected = false
    jsonOut.bluetooth_connected = false
    jsonOut.simulated = true
    jsonOut.label = currentConfig.data_label
    jsonOut.heart_rate = Math.floor(Math.random() * (156 - 72 + 1)) + 72
    jsonOut.units = 'bpm'
    jsonOut.device_mac_address = 'SIMULATED'

    console.info('test-mode = true, generating mock sensor data..')
    sendMessage(JSON.stringify(jsonOut))
  } else {
    // Check if we have a device MAC address. If not, then scan the BLE radio and try to find an appropriate device and grab the MAC address, then continue
    if (deviceMac === '') {
      // Get the scan list of devices and try to find a match... if a match is found, parse the MAC address
      request({
        uri: 'http://iofog:10500/devices',
        method: 'GET',
        headers: {
          'Content-Type': 'application/json'
        }
      },
      function handleDeviceListResponse (error, response, body) {
        var bleAvailable = true

        if (error) {
          bleAvailable = false
          console.error('Error connecting to Bluetooth Low Energy hardware abstraction API:', error)
        } else {
          var respObj = JSON.parse(body)
          if (response.statusCode === 200) {
            // Loop through all of the devices and look for one that has a "local_name" that starts with the device name prefix
            respObj.forEach(function (currentDevice) {
              if (currentDevice.hasOwnProperty('local_name')) {
                if (currentDevice.local_name.startsWith(LOCAL_NAME_PREFIX)) {
                  deviceMac = currentDevice.mac_id
                }
              }
            })
          } else {
            bleAvailable = false
            console.error('Bad Bluetooth API response status code = ' + response.statusCode + ' : ', respObj)
          }
        }

        if (!bleAvailable) {
          // We seem to have a problem reaching the BLE HAL layer - send our message already
          notifyURL = ''
          deviceMac = ''
          var jsonOut = {}
          jsonOut.device_connected = false
          jsonOut.bluetooth_connected = false
          jsonOut.simulated = false
          jsonOut.label = currentConfig.data_label
          jsonOut.heart_rate = 0
          jsonOut.units = 'bpm'
          jsonOut.device_mac_address = ''

          sendMessage(JSON.stringify(jsonOut))
        }
      }
      )
    } else {
      if (notifyURL === '') {
        // We need to subscribe to device notifications and store the retrieval URL
        request({
          uri: 'http://iofog:10500/device/mac/' + deviceMac + '/service/180d/characteristic/2a37/notify',
          method: 'GET',
          headers: {
            'Content-Type': 'application/json'
          }
        },
        function handleSubscribeResponse (error, response, body) {
          var bleAvailable = true

          if (error) {
            bleAvailable = false
            console.info('Error connecting to Bluetooth Low Energy hardware abstraction API:', error)
          } else {
            var respObj = JSON.parse(body)
            if (response.statusCode === 200) {
              // Parse the notification URL and send a bad connection data result if not parseable
              var deviceURL = respObj.url
              if (deviceURL && deviceURL.length > 6) {
                notifyURL = deviceURL
              } else {
                // We have a problem with the data subscription URL - send a data message with flags
                notifyURL = ''
                deviceMac = ''
                var jsonOut = {}
                jsonOut.device_connected = false
                jsonOut.bluetooth_connected = true
                jsonOut.simulated = false
                jsonOut.label = currentConfig.data_label
                jsonOut.heart_rate = 0
                jsonOut.units = 'bpm'
                jsonOut.device_mac_address = deviceMac

                sendMessage(JSON.stringify(jsonOut))
              }
            } else {
              bleAvailable = false
              console.error('Bad Bluetooth API response status code = ' + response.statusCode + ' : ', respObj)
            }
          }

          if (!bleAvailable) {
            // We seem to have a problem reaching the BLE HAL layer - send our message already
            notifyURL = ''
            deviceMac = ''
            var jsonOut = {}
            jsonOut.device_connected = false
            jsonOut.bluetooth_connected = false
            jsonOut.simulated = false
            jsonOut.label = currentConfig.data_label
            jsonOut.heart_rate = 0
            jsonOut.units = 'bpm'
            jsonOut.device_mac_address = ''

            console.info('Sending dummy sensor reading via ioMessage')
            console.debug(JSON.stringify(jsonOut, null, 2))
            sendMessage(JSON.stringify(jsonOut))
          }
        }
        )
      } else {
        // We have everything we need to fetch the data - get the unread heart rate data, grab the latest one, and transmit
        request({
          uri: 'http://iofog:10500/' + notifyURL,
          headers: {
            'Content-Type': 'application/json'
          },
          method: 'GET'
        }, function handleRESTBlueDataResponse (error, response, body) {
          var bleAvailable = true

          if (error) {
            bleAvailable = false
            console.info('Error connecting to Bluetooth Low Energy hardware abstraction API:', error)
          } else {
            var respObj = JSON.parse(body)
            if (response.statusCode === 200) {
              if (respObj.data) {
                var lastItem = respObj.data.length - 1
                var data = new Buffer(respObj.data[lastItem], 'base64')
                var resultHexFull = data.toString('hex')
                var resultHexHeartRate = resultHexFull.substr(2, 2)
                var heartRate = parseInt(resultHexHeartRate, 16)

                var jsonOut = {}
                jsonOut.device_connected = true
                jsonOut.bluetooth_connected = true
                jsonOut.simulated = false
                jsonOut.label = currentConfig.data_label
                jsonOut.heart_rate = heartRate
                jsonOut.units = 'bpm'
                jsonOut.device_mac_address = deviceMac

                sendMessage(JSON.stringify(jsonOut))
              }

              // Check to see if this was our last data on this subscription - if so, we will need to start a new subscription
              // And we should assume that the device MAC has changed or a different device will be used
              if (respObj.device_disconnected === true) {
                notifyURL = ''
                deviceMac = ''
              }
            } else if (response.statusCode === 404) {
              notifyURL = ''
            } else {
              bleAvailable = false
              console.error('Bad Bluetooth API response status code = ' + response.statusCode + ' : ', respObj)
            }
          }

          if (!bleAvailable) {
            // We seem to have a problem reaching the BLE HAL layer - send our message already
            notifyURL = ''
            deviceMac = ''
            var jsonOut = {}
            jsonOut.device_connected = false
            jsonOut.bluetooth_connected = false
            jsonOut.simulated = false
            jsonOut.label = currentConfig.data_label
            jsonOut.heart_rate = 0
            jsonOut.units = 'bpm'
            jsonOut.device_mac_address = ''

            sendMessage(JSON.stringify(jsonOut))
          }
        })
      }
    }
  }
}

function sendMessage (jsonMsg) {
  var ioMessage = ioFogClient.ioMessage({
    'tag': '',
    'groupid': '',
    'sequencenumber': 1,
    'sequencetotal': 1,
    'priority': 0,
    'authid': '',
    'authgroup': '',
    'chainposition': 0,
    'hash': '',
    'previoushash': '',
    'nonce': '',
    'difficultytarget': 0,
    'infotype': INFOTYPE,
    'infoformat': INFOFORMAT,
    'contextdata': '',
    'contentdata': jsonMsg
  })

  ioFogClient.wsSendMessage(ioMessage)
}

setInterval(runProcess, 5000)
