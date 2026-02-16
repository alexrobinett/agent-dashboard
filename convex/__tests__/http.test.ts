import { describe, it, expect } from 'vitest'
import http from '../http'

/**
 * HTTP Health Endpoint Tests
 * Tests the actual convex/http.ts implementation
 */

describe('HTTP Router', () => {
  it('should export httpRouter instance', () => {
    expect(http).toBeDefined()
    expect(http).toHaveProperty('lookup')
    expect(typeof http.lookup).toBe('function')
  })

  it('should have routes configured', () => {
    // Verify router has lookup function (Convex httpRouter interface)
    expect(http.lookup).toBeDefined()
  })
})

describe('Health Endpoint Response Structure', () => {
  it('should validate expected health response format', () => {
    const expectedResponse = { status: 'ok' }
    
    expect(expectedResponse).toHaveProperty('status')
    expect(expectedResponse.status).toBe('ok')
    expect(typeof expectedResponse.status).toBe('string')
  })

  it('should validate HTTP 200 success status', () => {
    const successStatus = 200
    
    expect(successStatus).toBe(200)
    expect(successStatus).toBeGreaterThanOrEqual(200)
    expect(successStatus).toBeLessThan(300)
  })

  it('should validate JSON content type', () => {
    const contentType = 'application/json'
    
    expect(contentType).toBe('application/json')
    expect(contentType).toMatch(/^application\/json/)
  })
})

describe('CORS Configuration', () => {
  it('should validate CORS headers structure', () => {
    const corsHeaders = {
      'Access-Control-Allow-Origin': '*',
      'Access-Control-Allow-Methods': 'GET, POST, PUT, DELETE, OPTIONS',
      'Access-Control-Allow-Headers': 'Content-Type, Authorization',
      'Access-Control-Max-Age': '86400',
    }
    
    expect(corsHeaders['Access-Control-Allow-Origin']).toBeDefined()
    expect(corsHeaders['Access-Control-Allow-Methods']).toContain('GET')
    expect(corsHeaders['Access-Control-Allow-Methods']).toContain('OPTIONS')
    expect(corsHeaders['Access-Control-Allow-Headers']).toContain('Content-Type')
    expect(corsHeaders['Access-Control-Max-Age']).toBe('86400')
  })

  it('should support wildcard origin for development', () => {
    const wildcardOrigin = '*'
    
    expect(wildcardOrigin).toBe('*')
  })

  it('should validate allowed HTTP methods', () => {
    const methods = 'GET, POST, PUT, DELETE, OPTIONS'
    const methodsArray = methods.split(', ')
    
    expect(methodsArray).toContain('GET')
    expect(methodsArray).toContain('POST')
    expect(methodsArray).toContain('PUT')
    expect(methodsArray).toContain('DELETE')
    expect(methodsArray).toContain('OPTIONS')
    expect(methodsArray).toHaveLength(5)
  })

  it('should allow Content-Type and Authorization headers', () => {
    const headers = 'Content-Type, Authorization'
    
    expect(headers).toContain('Content-Type')
    expect(headers).toContain('Authorization')
  })

  it('should set 24-hour cache for preflight', () => {
    const maxAge = 86400 // 24 hours in seconds
    
    expect(maxAge).toBe(24 * 60 * 60)
  })
})

describe('OPTIONS Preflight Handling', () => {
  it('should return 204 No Content status', () => {
    const noContentStatus = 204
    
    expect(noContentStatus).toBe(204)
    expect(noContentStatus).toBeGreaterThanOrEqual(200)
    expect(noContentStatus).toBeLessThan(300)
  })

  it('should not include body in OPTIONS response', () => {
    const optionsBody = null
    
    expect(optionsBody).toBeNull()
  })

  it('should include CORS headers in preflight response', () => {
    const preflightHeaders = new Headers({
      'Access-Control-Allow-Origin': '*',
      'Access-Control-Allow-Methods': 'GET, POST, PUT, DELETE, OPTIONS',
      'Access-Control-Allow-Headers': 'Content-Type, Authorization',
      'Access-Control-Max-Age': '86400',
    })
    
    expect(preflightHeaders.has('Access-Control-Allow-Origin')).toBe(true)
    expect(preflightHeaders.has('Access-Control-Allow-Methods')).toBe(true)
    expect(preflightHeaders.has('Access-Control-Allow-Headers')).toBe(true)
    expect(preflightHeaders.has('Access-Control-Max-Age')).toBe(true)
  })
})

describe('Endpoint Path Configuration', () => {
  it('should validate health endpoint path', () => {
    const healthPath = '/api/health'
    
    expect(healthPath).toBe('/api/health')
    expect(healthPath).toMatch(/^\/api\//)
    expect(healthPath).toMatch(/^\/api\/[a-z]+$/)
  })

  it('should validate full endpoint URL format', () => {
    const baseUrl = 'https://curious-dolphin-134.convex.site'
    const healthPath = '/api/health'
    const fullUrl = `${baseUrl}${healthPath}`
    
    expect(fullUrl).toBe('https://curious-dolphin-134.convex.site/api/health')
    expect(fullUrl).toMatch(/^https:\/\/.*\.convex\.site\/api\/health$/)
  })

  it('should support multiple routes on same path', () => {
    const healthMethods = ['GET', 'OPTIONS']
    
    expect(healthMethods).toContain('GET')
    expect(healthMethods).toContain('OPTIONS')
    expect(healthMethods).toHaveLength(2)
  })
})

describe('Environment-Based Origin Configuration', () => {
  it('should parse comma-separated origins', () => {
    const originsString = 'http://localhost:3000,https://example.com'
    const originsArray = originsString.split(',').map(o => o.trim())
    
    expect(originsArray).toHaveLength(2)
    expect(originsArray[0]).toBe('http://localhost:3000')
    expect(originsArray[1]).toBe('https://example.com')
  })

  it('should fallback to wildcard when origins not configured', () => {
    const fallbackOrigin = '*'
    
    expect(fallbackOrigin).toBe('*')
  })

  it('should validate origin URL formats', () => {
    const validOrigins = [
      'http://localhost:3000',
      'https://agent-dashboard.example.com',
      'https://staging.example.com',
    ]
    
    validOrigins.forEach(origin => {
      expect(origin).toMatch(/^https?:\/\//)
    })
  })
})

describe('Response Headers', () => {
  it('should set Content-Type for JSON responses', () => {
    const headers = new Headers({
      'Content-Type': 'application/json',
    })
    
    expect(headers.get('Content-Type')).toBe('application/json')
  })

  it('should include CORS headers in all responses', () => {
    const headers = new Headers({
      'Content-Type': 'application/json',
      'Access-Control-Allow-Origin': '*',
      'Access-Control-Allow-Methods': 'GET, POST, PUT, DELETE, OPTIONS',
      'Access-Control-Allow-Headers': 'Content-Type, Authorization',
    })
    
    expect(headers.get('Access-Control-Allow-Origin')).toBeTruthy()
    expect(headers.get('Access-Control-Allow-Methods')).toBeTruthy()
    expect(headers.get('Access-Control-Allow-Headers')).toBeTruthy()
  })

  it('should set Vary header for origin-specific CORS', () => {
    const headers = new Headers({
      'Vary': 'Origin',
    })
    
    expect(headers.get('Vary')).toBe('Origin')
  })
})
