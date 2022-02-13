import React, { useState, useEffect, useRef } from 'react'
import Chart from 'chart.js'
import { useInterval } from './hooks/useInterval'
import logo from './logo.png'
import './App.scss'
import { ReactComponent as Logo } from './assets/icons/logo.svg'
import { ReactComponent as DocIcon } from './assets/icons/docs.svg'
import { ReactComponent as GithubIcon } from './assets/icons/github.svg'
import { ReactComponent as HeartRateIcon } from './assets/icons/heart-rate.svg'
import { ReactComponent as MinHeartRateIcon } from './assets/icons/min-heart-rate.svg'
import { ReactComponent as MaxHeartRateIcon } from './assets/icons/max-heart-rate.svg'

function App () {
  const [datasets, setDatasets] = useState([])
  const [minimal, setMinimal] = useState(0)
  const [maximal, setMaximal] = useState(0)
  const [current, setCurrent] = useState(0)
  const chartRef = useRef(null)
  const chartId = 'HeartrateChart'
  const maxNbPoints = 100
  const apiUrl = '/api/heartrate'
  const colors = {
    blue: '#5AC8FA',
    red: '#FD575D',
    green: '#1BC0A9',
    gold: '#EDAC40',
    neutral: ['#ffffff', '#E3E8F1', '#A9B2BC', '#0A415E', '#012D44', '#002131'],
  }
  const colorArray = [
    colors.blue,
    'rgba(0, 0, 255, 1)',
    'rgba(0, 255, 0, 1)'
  ]

  const mapDataset = (dataset, idx) => {
    const colorIdx = idx % colorArray.length
    const color = colorArray[colorIdx]
    const canvas = document.getElement
    let fillColor = color + '80'
    setCurrent(dataset.data[dataset.data.length - 1])
    const sortedDataset = [...dataset.data]
    sortedDataset.sort((a, b) => a - b)
    setMinimal(sortedDataset[0])
    setMaximal(sortedDataset[sortedDataset.length - 1])
    if (chartRef.current != null) {
      const chartElement = document.getElementById(chartId)
      const ctx = chartElement.getContext('2d')
      fillColor = ctx.createLinearGradient(0, 0, 0, chartRef.current.height)
      fillColor.addColorStop(0, color + '80')
      fillColor.addColorStop(1, color + '00')
    }
    if (dataset.data.length >= maxNbPoints) {
      dataset.data = dataset.data.slice(0, maxNbPoints)
    } else {
      const filler = Array(maxNbPoints - dataset.data.length).fill(null)
      dataset.data = dataset.data.concat(filler)
    }

    dataset.backgroundColor = fillColor
    dataset.borderColor = color
    dataset.pointBackgroundColor = colors.neutral[0]
    dataset.pointBorderColor = colors.neutral[0]
    dataset.borderWidth = 2
    dataset.pointRadius = 2

    return dataset
  }

  useInterval(() => {
    window.fetch(apiUrl)
      .then(res => res.json())
      .then(newDatasets => {
        return newDatasets.map(mapDataset)
      })
      .then(setDatasets)
  }, [1000])

  useEffect(() => {
    chartRef.current = new Chart(chartId, {
      type: 'line',
      data: {
        labels: [],
        datasets: []
      },
      defaults: {
        global: {
          defaultColor: colors.neutral[2]
        }
      },
      options: {
        legend: {
          display: false,
        },
        animation: false,
        responsive: false,
        maintainAspectRatio: true,
        scales: {
          xAxes: [{
            ticks: { display: true, callback: () => '' },
            gridLines: { display: true, drawOnChartArea: false, drawTicks: false, drawBorder: true }
          }],
          yAxes: [{
            ticks: {
              callback: function (value, index, values) {
                return value + ' BPM     '
              },
              min: 40,
              max: 160,
              fontFamily: 'Gilroy',
              color: colors.neutral[2]
            },
            gridLines: {
              color: colors.neutral[2] + '40',
              drawTicks: false,
              tickMarkLength: 50,
              borderDash: [1, 4]
            }
          }]
        },
        title: {
          display: false
        }
      }
    })
  }, [])

  useEffect(() => {
    const chart = chartRef.current
    if (!chart) return
    chart.data.labels = Array(maxNbPoints).fill(null)
    chart.data.datasets = datasets
    chart.update()
  }, [datasets, chartRef])

  return (
    <div>
      <nav className='navbar navbar-expand-lg navbar-light'>
        <a className='navbar-brand logo' href='/'><Logo /><div>DARCY HEALTHCARE WEARABLES DEMO</div></a>
        <div className='links'>
          {/* <a className='link' href="" target="_blank"><DocIcon /><div>Build your own darcy apps</div></a> */}
          <a className='link' href="https://github.com/darcyai/healthcare-wearable-demo" target="_blank"><GithubIcon /><div>Browse code</div></a>
        </div>
      </nav>
      <div className='container'>
        <div className="column">
          <div className="row">
            <div className="row-section">
              <HeartRateIcon />
              <div className='number'>{current}</div>
              <div className='label'>current<br /> HEART RATE</div>
            </div>
            <div className="row-section">
              <MaxHeartRateIcon />
              <div className='number'>{maximal}</div>
              <div className='label'>MAXIMUM<br /> HEART RATE</div>
            </div>
            <div className="row-section">
              <MinHeartRateIcon />
              <div className='number'>{minimal}</div>
              <div className='label'>minimum<br /> HEART RATE</div>
            </div>
          </div>
          <div className="chart-container">
            <canvas id={chartId} className='chart' />
          </div>
          <div className="row">
            <div className='info'>
              <div className='info-title'>ABOUT THIS DEMO APP</div>
              <div className='info-content'>
                This demo app is an example of a local heart rate sensor (edge node 1) sending data to a nearby data collector (edge node 2), then sharing via automatic public port to the cloud. A similar technique could be used to gather and share any data between any number of edge nodes with limited connectivity (or to reduce data cost).
              </div>
            </div>
          </div>
        </div>
      </div>
    </div>
  )
}

export default App
