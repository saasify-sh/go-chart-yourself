import { Browser, Page, launch } from 'puppeteer-core'

import { getLaunchOptions } from './options'

// cache the current chrome instance between serverless invocations
let _browser: Browser | null = null

export async function getPage(): Promise<Page> {
  if (!_browser) {
    const options = await getLaunchOptions()
    _browser = await launch(options)
  }

  return _browser.newPage()
}
