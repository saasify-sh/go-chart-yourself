import * as fs from 'fs'
import { HttpResponse } from 'fts-core'

import { ChartType, ChartData, ChartOptions } from 'chart.js'
import { getPage } from './lib/page'
import { GoogleFont } from './google-fonts'

type ChartStyle = 'normal' | 'rough'
type ChartRoughFillStyle =
  | 'hachure'
  | 'solid'
  | 'zigzag'
  | 'cross-hatch'
  | 'dots'
  | 'starburst'
  | 'dashed'
  | 'zigzag-line'

export default async function render(
  type: ChartType,
  data: ChartData,
  options?: ChartOptions,
  width: number = 512,
  height: number = 320,
  deviceScaleFactor: number = 2,
  fontFamily?: GoogleFont,
  fontSize: number = 12,
  fontColor: string = '#666',
  fontStyle: string = 'normal',
  style: ChartStyle = 'rough',
  roughness: number = 1,
  bowing: number = 1,
  fillStyle: ChartRoughFillStyle = 'hachure',
  fillWeight: number = 0.5,
  hachureAngle: number = -41,
  hachureGap: number = 4,
  curveStepCount: number = 9,
  simplification: number = 9
): Promise<HttpResponse> {
  const fonts = fontFamily
    ? fontFamily.split(',').map((font) => font.trim())
    : []

  const fontHeader = fonts.length
    ? `<link rel="stylesheet" href="https://fonts.googleapis.com/css?family=${fonts
        .map((font) => font.replace(/ /g, '+'))
        .join('|')}">`
    : ''

  const fontsToLoad = fonts.map((font) => `new FontFaceObserver('${font}')`)
  const fontLoader = fontsToLoad.length
    ? `Promise.all([ ${fontsToLoad.join(
        ', '
      )} ].map((f) => f.load())).then(ready);`
    : 'ready();'

  const chartConfig = {
    type,
    data,
    options: {
      ...options,

      // disable all animations
      animation: {
        duration: 0
      },
      hover: {
        animationDuration: 0
      },
      responsiveAnimationDuration: 0,

      // configure roughjs plugin
      plugins: {
        rough: {
          roughness,
          bowing,
          fillStyle,
          fillWeight,
          hachureAngle,
          hachureGap,
          curveStepCount,
          simplification
        }
      }
    }
  }

  const html = `
<html>
<head>
  <meta charset="UTF-8">

  ${fontHeader}

  <script src="https://cdnjs.cloudflare.com/ajax/libs/fontfaceobserver/2.1.0/fontfaceobserver.standalone.js"></script>
  <script src="https://cdnjs.cloudflare.com/ajax/libs/Chart.js/2.9.3/Chart.bundle.min.js"></script>
  <script src="https://cdn.jsdelivr.net/npm/roughjs@3.1.0/dist/rough.min.js"></script>
  <script src="https://cdn.jsdelivr.net/npm/chartjs-plugin-rough@0.2.0/dist/chartjs-plugin-rough.min.js"></script>

  <style>
* {
  box-sizing: border-box;
  margin: 0;
  padding: 0;
}

body {
  background: transparent;
  overflow: hidden;
}
  </style>
</head>

<body>

<canvas id="main" width="${width}" height="${height}"></canvas>

<script>
  function ready () {
    const chartConfig = ${JSON.stringify(chartConfig)};
    const plugins = [];

    ${
      style === 'rough'
        ? `
    Chart.plugins.register(ChartRough);
    plugins.push(ChartRough);
    `
        : ''
    }

    Chart.defaults.global.defaultFontFamily = ${JSON.stringify(fontFamily)};
    Chart.defaults.global.defaultFontSize = ${JSON.stringify(fontSize)};
    Chart.defaults.global.defaultFontColor = ${JSON.stringify(fontColor)};
    Chart.defaults.global.defaultFontStyle = ${JSON.stringify(fontStyle)};

    const ctx = document.getElementById('main');
    window.chart = new Chart(ctx, { ...chartConfig, plugins });

    const div = document.createElement('div');
    div.className = 'ready';
    document.body.appendChild(div);
  }

  ${fontLoader}
</script>

</body>
</html>
`

  const page = await getPage()

  page.on('console', console.log)
  page.on('error', console.error)

  await page.setViewport({
    deviceScaleFactor,
    width,
    height
  })
  await page.setContent(html)
  await page.waitForSelector('.ready')

  const frame = page.mainFrame()
  const mainHandle = await frame.$('#main')
  const body = await mainHandle.screenshot({
    omitBackground: true
  })
  await Promise.all([mainHandle.dispose(), page.close()])

  return {
    headers: {
      'Content-Type': 'image/png'
    },
    statusCode: 200,
    body
  }
}

render(
  'bar',
  {
    labels: ['Red', 'Blue', 'Yellow', 'Green', 'Purple', 'Orange'],
    datasets: [
      {
        label: '# of Votes',
        data: [12, 19, 3, 5, 2, 3],
        backgroundColor: [
          'rgba(255, 99, 132, 0.2)',
          'rgba(54, 162, 235, 0.2)',
          'rgba(255, 206, 86, 0.2)',
          'rgba(75, 192, 192, 0.2)',
          'rgba(153, 102, 255, 0.2)',
          'rgba(255, 159, 64, 0.2)'
        ],
        borderColor: [
          'rgba(255, 99, 132, 1)',
          'rgba(54, 162, 235, 1)',
          'rgba(255, 206, 86, 1)',
          'rgba(75, 192, 192, 1)',
          'rgba(153, 102, 255, 1)',
          'rgba(255, 159, 64, 1)'
        ],
        borderWidth: 1
      }
    ]
  },
  {
    scales: {
      yAxes: [
        {
          ticks: {
            beginAtZero: true
          }
        }
      ]
    }
  }
).then((result) => {
  console.log('done')
  fs.writeFileSync('out.png', result.body)
})
