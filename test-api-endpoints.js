#!/usr/bin/env node

/**
 * Comprehensive API Test Suite for 10x-cards
 * Tests all endpoints against the running development server
 */

import { createClient } from '@supabase/supabase-js';

const SUPABASE_URL = 'http://127.0.0.1:54321';
const SUPABASE_ANON_KEY = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZS1kZW1vIiwicm9sZSI6ImFub24iLCJleHAiOjE5ODM4MTI5OTZ9.CRXP1A7WOeoJeXxjNni43kdQwgnWNReilDMblYTn_I0';
const API_BASE_URL = 'http://localhost:3000/api';

const supabase = createClient(SUPABASE_URL, SUPABASE_ANON_KEY);

let authToken = null;
let testUserId = null;
let testDeckId = null;
let testCardId = null;

async function createTestUser() {
  console.log('🔧 Creating test user...');
  
  const email = `test-${Date.now()}@example.com`;
  const password = 'testpassword123';
  
  const { data, error } = await supabase.auth.signUp({
    email,
    password,
  });
  
  if (error) {
    console.error('❌ Failed to create test user:', error.message);
    return false;
  }
  
  authToken = data.session?.access_token;
  testUserId = data.user?.id;
  
  console.log('✅ Test user created:', { email, userId: testUserId });
  return true;
}

async function testEndpoint(method, path, data = null, expectedStatus = 200) {
  const url = `${API_BASE_URL}${path}`;
  const options = {
    method,
    headers: {
      'Content-Type': 'application/json',
      'Authorization': `Bearer ${authToken}`,
    },
  };
  
  if (data) {
    options.body = JSON.stringify(data);
  }
  
  try {
    const response = await fetch(url, options);
    
    // Handle 204 No Content responses (like DELETE endpoints)
    let result = null;
    if (response.status !== 204) {
      try {
        result = await response.json();
      } catch (jsonError) {
        console.log(`⚠️  ${method} ${path} - Could not parse JSON response:`, jsonError.message);
        result = null;
      }
    }
    
    if (response.status === expectedStatus) {
      console.log(`✅ ${method} ${path} - Status ${response.status}`);
      return { success: true, data: result, status: response.status };
    } else {
      console.log(`❌ ${method} ${path} - Expected ${expectedStatus}, got ${response.status}`);
      if (result) console.log('   Response:', result);
      return { success: false, data: result, status: response.status };
    }
  } catch (error) {
    console.log(`❌ ${method} ${path} - Network error:`, error.message);
    return { success: false, error: error.message };
  }
}

async function runTests() {
  console.log('🚀 Starting API endpoint tests...\n');
  
  // 1. Create test user
  if (!(await createTestUser())) {
    return;
  }
  
  console.log('\n📋 Testing Profile endpoints...');
  
  // 2. Test profile endpoints
  let result = await testEndpoint('GET', '/profiles/me');
  if (result.success) {
    console.log('   Profile data:', result.data);
  }
  
  await testEndpoint('PUT', '/profiles/me', {
    display_name: 'Test User',
    timezone: 'America/New_York',
    locale: 'en-US'
  });
  
  console.log('\n📚 Testing Deck endpoints...');
  
  // 3. Test deck endpoints
  result = await testEndpoint('GET', '/decks');
  if (result.success) {
    console.log('   Decks count:', result.data.items.length);
  }
  
  result = await testEndpoint('POST', '/decks', {
    name: 'Test Deck',
    slug: 'test-deck',
    language_code: 'en'
  }, 201);
  
  if (result.success) {
    testDeckId = result.data.id;
    console.log('   Created deck ID:', testDeckId);
  }
  
  if (testDeckId) {
    await testEndpoint('GET', `/decks/${testDeckId}`);
    await testEndpoint('PUT', `/decks/${testDeckId}`, {
      name: 'Updated Test Deck'
    });
  }
  
  console.log('\n🃏 Testing Card endpoints...');
  
  // 4. Test card endpoints
  if (testDeckId) {
    result = await testEndpoint('GET', `/decks/${testDeckId}/cards`);
    if (result.success) {
      console.log('   Cards count:', result.data.items.length);
    }
    
    result = await testEndpoint('POST', `/decks/${testDeckId}/cards`, {
      front: 'Test question front side',
      back: 'Test answer back side',
      language_code: 'en'
    }, 201);
    
    if (result.success) {
      testCardId = result.data.id;
      console.log('   Created card ID:', testCardId);
    }
    
    if (testCardId) {
      await testEndpoint('GET', `/decks/${testDeckId}/cards/${testCardId}`);
      await testEndpoint('PUT', `/decks/${testDeckId}/cards/${testCardId}`, {
        front: 'Updated question front'
      });
    }
  }
  
  console.log('\n📊 Testing Study endpoints...');
  
  // 5. Test study endpoints
  await testEndpoint('GET', '/study/queue');
  await testEndpoint('GET', '/me/statistics');
  
  if (testCardId) {
    await testEndpoint('POST', `/cards/${testCardId}/reviews`, {
      rating: 2,
      duration_ms: 5000
    }, 201);
  }
  
  console.log('\n🤖 Testing AI endpoints...');
  
  // 6. Test AI endpoints (basic validation)
  await testEndpoint('POST', '/ai/generations', {
    source_text: 'Short text'
  }, 400); // Should fail due to length constraint
  
  const longText = 'A'.repeat(1500); // 1500 characters
  result = await testEndpoint('POST', '/ai/generations', {
    source_text: longText,
    model: 'test-model'
  }, 202);
  
  if (result.success) {
    console.log('   AI generation created:', result.data.generation_id);
  }
  
  console.log('\n🧹 Cleaning up...');
  
  // 7. Cleanup
  if (testDeckId) {
    await testEndpoint('DELETE', `/decks/${testDeckId}/hard`, null, 204);
  }
  
  console.log('\n✅ All tests completed!');
}

// Run the tests
runTests().catch(console.error);
