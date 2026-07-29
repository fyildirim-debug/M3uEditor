import fs from 'node:fs'
import path from 'node:path'
import process from 'node:process'
import { fileURLToPath } from 'node:url'

const directory = path.dirname(fileURLToPath(import.meta.url))

function flattenKeys(value, prefix = '') {
  return Object.entries(value).flatMap(([key, nestedValue]) => {
    const fullKey = prefix ? `${prefix}.${key}` : key
    if (nestedValue && typeof nestedValue === 'object' && !Array.isArray(nestedValue)) {
      return flattenKeys(nestedValue, fullKey)
    }
    return [fullKey]
  })
}

function readLanguage(filename) {
  return JSON.parse(fs.readFileSync(path.join(directory, filename), 'utf8'))
}

const trKeys = new Set(flattenKeys(readLanguage('tr.json')))
const enKeys = new Set(flattenKeys(readLanguage('en.json')))
const missingInEnglish = [...trKeys].filter(key => !enKeys.has(key)).sort()
const missingInTurkish = [...enKeys].filter(key => !trKeys.has(key)).sort()

console.log(`TR anahtar sayısı: ${trKeys.size}`)
console.log(`EN key count: ${enKeys.size}`)
console.log(`EN dosyasında eksik: ${missingInEnglish.length}`)
console.log(`TR dosyasında eksik: ${missingInTurkish.length}`)

if (missingInEnglish.length) console.error(`Eksik EN anahtarları: ${missingInEnglish.join(', ')}`)
if (missingInTurkish.length) console.error(`Missing TR keys: ${missingInTurkish.join(', ')}`)

if (missingInEnglish.length || missingInTurkish.length) process.exitCode = 1
else console.log('TR/EN key parity: OK')
