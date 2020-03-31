const fs = require('fs')
const fetch = require('node-fetch')
const { google } = require('googleapis')
const credentials = require('./secret-credentials.json')

const client = new google.auth.JWT(credentials.client_email, null, credentials.private_key, [])

// const initUrl = 'https://www.liberation.fr/mapi/sections/99773/contents/?format=json'

// recurseFetchApiPage()

// async function recurseFetchApiPage (currUrl = initUrl, results = [], page = 0) {
//   console.log(`loading page ${page}...\n`)
//   const data = await fetchApiPage(currUrl)
//   const newResults = [...results, ...data.results]
//   if (data.next && data.results.length) return recurseFetchApiPage(data.next, newResults, page + 1)
//   console.log(`done.\n`)
//   console.log(`Found ${newResults.length} results`)
//   return newResults
// }

// async function fetchApiPage (url) {
//   try {
//     const res = await fetch(url)
//     const data = await res.json()
//     return data
//   } catch (e) {
//     console.log(e)
//     process.exit(1)
//   }
// }
