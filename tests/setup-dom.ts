// tests/setup-dom.ts — runs before every jsdom test file.
import '@testing-library/jest-dom/vitest'
import { cleanup } from '@testing-library/react'
import { afterEach } from 'vitest'

// Unmount between tests so queries can't match a previous test's DOM.
afterEach(() => {
  cleanup()
})

// jsdom doesn't implement File.prototype.text(), which the CSV import relies on
// to read a chosen file. Polyfilled here rather than reshaping the component
// around a test limitation.
if (typeof File !== 'undefined' && !File.prototype.text) {
  File.prototype.text = function () {
    return Promise.resolve((this as unknown as { __text?: string }).__text ?? '')
  }
}
