import { config } from 'dotenv';
import { SogniClientWrapper } from '../src';

// Load environment variables from .env file
config();

/**
 * Example demonstrating basic Sogni Client Wrapper usage
 *
 * To run this example:
 * 1. Create a .env file in the project root with your credentials:
 *    SOGNI_USERNAME=your_username
 *    SOGNI_PASSWORD=your_password
 *
 * 2. Run the example:
 *    npm run build && node dist/examples/simple-test.js
 *    or
 *    npx tsx examples/simple-test.ts
 */
async function testClient() {
  // Check for required environment variables
  if (!process.env.SOGNI_USERNAME || !process.env.SOGNI_PASSWORD) {
    console.error('❌ Error: Missing required environment variables');
    console.error('Please create a .env file with SOGNI_USERNAME and SOGNI_PASSWORD');
    console.error('See .env.example for reference');
    process.exit(1);
  }

  const client = new SogniClientWrapper({
    // A stable app id (never a new random one per run): the socket recovers this
    // app's projects after a restart, and each new id uses up an app-id registration.
    appId: process.env.SOGNI_APP_ID || 'sogni-intelligence-example-simple-test',
    username: process.env.SOGNI_USERNAME,
    password: process.env.SOGNI_PASSWORD,
    debug: true,
  });

  try {
    console.log('🔄 Connecting to Sogni Supernet...');
    await client.connect();
    console.log('✅ Connected successfully!\n');

    // Get account balance using the refreshBalance() method
    console.log('💰 Fetching account balance...');
    const balance = await client.getBalance();
    console.log('Account Balance:');
    console.log(`  - SOGNI tokens: ${balance.sogni.toFixed(2)}`);
    console.log(`  - SPARK tokens: ${balance.spark.toFixed(2)}`);
    console.log(`  - Last updated: ${balance.lastUpdated.toISOString()}\n`);

    // Get available models
    console.log('🎨 Fetching available models...');
    const models = await client.getAvailableModels({ sortByWorkers: true });
    console.log(`Found ${models.length} models available`);

    // Show top 5 models by worker count
    console.log('\nTop 5 Most Popular Models:');
    models.slice(0, 5).forEach((model, index) => {
      const recommendedSteps = model.recommendedSettings?.steps ?? 'n/a';
      const recommendedGuidance = model.recommendedSettings?.guidance ?? 'n/a';
      console.log(`  ${index + 1}. ${model.id}`);
      console.log(`     Workers: ${model.workerCount}`);
      console.log(`     Recommended: ${recommendedSteps} steps, ${recommendedGuidance} guidance`);
    });

  } catch (error) {
    console.error('❌ Test failed:', error);
    if (error instanceof Error) {
      console.error('Error details:', error.message);
    }
  } finally {
    console.log('\n🔌 Disconnecting...');
    await client.disconnect();
    console.log('✅ Disconnected successfully');
  }
}

// Run the test
testClient().catch(console.error);
