// Test the RapidAPI conversion service directly
const testConversion = async () => {
  const url = 'https://food-ingredient-measurement-conversion.p.rapidapi.com/convert?ingredient=flour&from=cup%20(US)&to=gram&value=1&numDigit=3';
  
  console.log('Testing API with URL:', url);
  
  try {
    const response = await fetch(url, {
      method: 'GET',
      headers: {
        'x-rapidapi-key': process.env.RAPIDAPI_KEY || '',
        'x-rapidapi-host': 'food-ingredient-measurement-conversion.p.rapidapi.com'
      }
    });
    
    console.log('Response status:', response.status);
    console.log('Response headers:', response.headers);
    
    const text = await response.text();
    console.log('Response text:', text);
    
    if (response.ok) {
      console.log('✓ API is working! Result:', text);
    } else {
      console.log('✗ API failed with status:', response.status);
    }
  } catch (error) {
    console.error('Error calling API:', error);
  }
};

testConversion();