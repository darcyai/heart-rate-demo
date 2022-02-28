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

const ioFogClient = require('@iofog/nodejs-sdk')
const express = require('express')
const app = express()
const _ = require('lodash')
const path = require('path')

const PORT = process.env.PORT || 80
const messageLimit = 100
const msgsBuffer = []

// Generate mock data
if (process.env.MOCK) {
  setInterval(() => {
    addMessage({
      contentdata: {
        label: 'Mocked user',
        heart_rate: Math.floor(Math.random() * (156 - 72 + 1)) + 72
      }
    })
  }, 2000)
}

const addMessage = (message) => {
  if (msgsBuffer.length > (messageLimit - 1)) {
    msgsBuffer.splice(0, (msgsBuffer.length - (messageLimit - 1)))
  }
  msgsBuffer.push(message)
}

const main = () => {
  // Start http server
  runServer()

  // Handle ioFog
  ioFogClient.wsControlConnection(
    {
      'onNewConfigSignal':
        function onNewConfigSignal () {
          // upon receiving signal about new config available -> go get it
          // fetchConfig();
        },
      'onError':
        function onControlSocketError (error) {
          console.error('There was an error with Control WebSocket connection to ioFog: ', error)
        }
    }
  )
  ioFogClient.wsMessageConnection(
    function (ioFogClient) { /* don't need to do anything on opened Message Socket */ },
    {
      'onMessages':
        function onMessagesSocket (messages) {
          if (messages) {
            // when getting new messages we store newest and delete oldest corresponding to configured limit
            for (let i = 0; i < messages.length; i++) {
              const message = messages[i]
              message.contentdata = JSON.parse(message.contentdata.toString('ascii'))
              addMessage(message)
            }
          }
        },
      'onMessageReceipt':
          function (messageId, timestamp) { /* we received the receipt for posted msg */ },
      'onError':
        function onMessageSocketError (error) {
          console.error('There was an error with Message WebSocket connection to ioFog: ', error)
        }
    }
  )
}

const runServer = () => {
  app.use('/', express.static(path.join(__dirname, 'client/public')))

  app.get('/api/raw', (req, res) => {
    res.status(200).json(msgsBuffer)
  })

  app.get('/api/heartrate', (req, res) => {
    const datasets = _.map(_.groupBy(msgsBuffer.map(msg => msg.contentdata), 'label'), (contentdata, label) => ({
      label,
      data: contentdata.map(d => d.heart_rate)
    }))
    res.status(200).json(datasets)
  })

  app.listen(PORT)
}

ioFogClient.init('iofog', 54321, null, main)
