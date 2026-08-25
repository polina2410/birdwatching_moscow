import { afterEach } from 'vitest'
import { cleanup } from '@testing-library/react'
import '@testing-library/jest-dom/vitest'

afterEach(cleanup)

// jsdom converts FormData bodies to ReadableStream immediately in the Request
// constructor, but formData() cannot parse it back when File objects are involved.
// Store the original FormData and return it directly to avoid the hang.
if (typeof globalThis.Request !== 'undefined') {
  const NativeRequest = globalThis.Request
  class PatchedRequest extends NativeRequest {
    private readonly _rawFormData: FormData | null
    constructor(input: RequestInfo | URL, init?: RequestInit) {
      super(input, init)
      this._rawFormData = init?.body instanceof FormData ? init.body : null
    }
    formData(): Promise<FormData> {
      if (this._rawFormData) return Promise.resolve(this._rawFormData)
      return super.formData()
    }
  }
  globalThis.Request = PatchedRequest as unknown as typeof globalThis.Request
}
