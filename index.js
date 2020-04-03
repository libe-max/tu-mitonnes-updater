const fs = require('fs')
const path = require('path')
const fetch = require('node-fetch')
const moment = require('moment')
const cron = require('node-cron')
const { google } = require('googleapis')
const credentials = require('./secret-credentials.json')

const spreadsheetId = '1TnhpEyk-2sofVWtErqvlt_5QFLHUHmJWUCql8NLxrwo'
const libeApiBaseUrl = 'https://www.liberation.fr/mapi/sections/99773/contents/?format=json'

doTheJob()
cron.schedule('0 0,15,30,45 * * * *', doTheJob)

/*
 *
 * MAIN SCRIPT
 *
 */

async function doTheJob () {
  try {
    console.log('START SYNCING')
    console.log(moment().format())
    console.log('=========================\n')
    console.log('Creating Google Sheets API client...')
    const sheetsApi = await createSheetsApiClient()
    console.log('done.\n')

    console.log('Getting raw sheet data...')
    const initRawSheetData = await getRawSheetData(sheetsApi)
    const initSheetData = makeObjectsFromRawSheetData(initRawSheetData)
    console.log(`${initSheetData.length} entries in sheet, latest one is:`)
    console.log(`${initSheetData[0].title} - Published on: ${moment(initSheetData[0].publication_date, 'X').format()}`)
    console.log('\n')
    
    console.log('Fetching new entries from Libération API...\n')
    const fetchedFromLibeApi = await fetchNewEntriesInLibeApi(initSheetData)

    if (!fetchedFromLibeApi.length) return console.log('Nothing new to save. See you.\n\n')

    console.log(fetchedFromLibeApi)
    console.log('\n')

    const newRawSheetData = await prepareNewRawSheetData(fetchedFromLibeApi, initSheetData)
    console.log(`${newRawSheetData.length} entries in new sheet, latest one is:\n`)
    console.log(newRawSheetData[0].title, moment(initSheetData[0].publication_date, 'X').format())
    console.log('\n')

    console.log('Saving new sheet...')
    const savedNewSheetData = await saveNewSheetData(newRawSheetData, sheetsApi)
    console.log('done.\n')

    console.log('Saving a backup of init sheet data...')
    const now = moment().format()
    const backupFileOutputPath = path.join(`${__dirname}/backups/${now}.json`)
    const jsonInitSheetData = JSON.stringify(initSheetData)
    fs.writeFileSync(backupFileOutputPath, jsonInitSheetData, 'utf8')
    console.log('done.\n')
    console.log('See you.\n\n')

  } catch (err) {
    console.log(err)
    return
  }
}

/*
 *
 * CREATE GOOGLE API CLIENT
 *
 */

async function createSheetsApiClient () {
  const googleAPIClient = new google.auth.JWT(
    credentials.client_email,
    null,
    credentials.private_key,
    ['https://www.googleapis.com/auth/spreadsheets']
  )
  return new Promise((resolve, reject) => {
    googleAPIClient.authorize(err => {
      if (err) return reject(`Error in createSheetsApiClient: ${err.message}`)
      const sheetsApi = google.sheets({
        version: 'v4',
        auth: googleAPIClient
      })
      resolve(sheetsApi)
    })
  })
}

/*
 *
 * GET RAW SHEET DATA
 *
 */

async function getRawSheetData (sheetsApi) {
  const options = { spreadsheetId, range: 'Data!A:W' }
  const response = await sheetsApi.spreadsheets.values.get(options)
  const sheetData = response.data.values
  return sheetData
}

/*
 *
 * MAKE OBJECTS FROM RAW SHEET DATA
 *
 */

function makeObjectsFromRawSheetData (rawData = []) {
  const keys = rawData[0]
  const lines = rawData.slice(1)
  const objects = lines.map(line => {
    const obj = {}
    line.forEach((cell, i) => {
      const key = keys[i]
      obj[key] = cell
    })
    return obj
  })
  return objects
}

/*
 *
 * FETCH NEW ENTRIES IN LIBE API
 *
 */

async function fetchNewEntriesInLibeApi (initEntries = [], currUrl = libeApiBaseUrl, results = [], page = 0) {
  console.log(`Loading API page ${page}...`)
  console.log(`URL: ${currUrl}`)
  const res = await fetch(currUrl)
  const pageData = await res.json()
  const pageResults = pageData.results
  const pageResultsThatAreNew = pageResults.filter(entry => {
    const entryId = entry.id.toString()
    const thisEntryInInit = initEntries.find(initEntry => initEntry.id === entryId)
    return !thisEntryInInit
  }).map(entry => {
    const flattenedEntry = { ...entry }
    delete flattenedEntry.call_photo
    if (entry.call_photo) Object.keys(entry.call_photo).forEach(key => {
      flattenedEntry[`call_photo_${key}`] = entry.call_photo[key]
    })
    return flattenedEntry
  })
  console.log(`Found ${pageResults.length} entries, including ${pageResultsThatAreNew.length} new ones.\n`)
  const newResults = [...results, ...pageResultsThatAreNew]
  if (!pageData.next || !pageResultsThatAreNew.length) return newResults
  return fetchNewEntriesInLibeApi(initEntries, pageData.next, newResults, page + 1)
}

/*
 *
 * PREPEND TO SHEET DATA
 *
 */

async function prepareNewRawSheetData (newData = [], initData = []) {
  const mergedData = [...newData, ...initData]
  const sortedMergedData = [...mergedData].sort((a, b) => a.modified_at - b.modified_at)
  const tableData = mergedData.map(article => ([
    '0',
    article.title || '',
    article.ingredients || '',
    article.dish_type || '',
    article.season || '',
    article.subtitle || '',
    article.url || '',
    article.id || '',
    article.slug || '',
    article.access || '',
    article.type || '',
    article.typology || '',
    article.primary_section || '',
    article.primary_section_title || '',
    article.call_photo_url || '',
    article.call_photo_credits || '',
    article.call_photo_caption || '',
    article.call_photo_width || '',
    article.call_photo_height || '',
    article.call_photo_format || '',
    article.publication_date || '',
    article.modified_at || '',
    article.updating_date || '',
    article.live_flux || ''
  ]))
  return tableData
}

/*
 *
 * SAVE NEW SHEET DATA
 *
 */

async function saveNewSheetData (newSheetData, sheetsApi) {
  const updOptions = {
    spreadsheetId,
    range: 'Data!A2',
    valueInputOption: 'USER_ENTERED',
    resource: { values: newSheetData }
  }
  const updation = await sheetsApi.spreadsheets.values.update(updOptions)
  return updation
}
