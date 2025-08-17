#!/usr/bin/env node

// Minimal example - Just check if text is safe
import { isSafe } from '../dist/index.js'

const text = process.argv[2] || 'Hello, world!'

const result = isSafe(text)
console.log(result)
