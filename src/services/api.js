import axios from 'axios';

// API base configurations
const COINGECKO_BASE_URL = 'https://api.coingecko.com/api/v3';
const GOOGLE_VISION_API_KEY = import.meta.env.VITE_GOOGLE_VISION_API_KEY;
const GOOGLE_SEARCH_API_KEY = import.meta.env.VITE_GOOGLE_SEARCH_API_KEY;
const GOOGLE_SEARCH_ENGINE_ID = import.meta.env.VITE_GOOGLE_SEARCH_ENGINE_ID;
const GEMINI_API_KEY = import.meta.env.VITE_GEMINI_API_KEY;

// Axios instances
const coinGeckoApi = axios.create({
  baseURL: COINGECKO_BASE_URL,
  timeout: 10000,
});

const googleApi = axios.create({
  timeout: 15000,
});

// CoinGecko API Services
export const cryptoService = {
  // Get cryptocurrency prices
  async getCryptoPrices(cryptoIds = ['bitcoin', 'ethereum', 'litecoin', 'dogecoin']) {
    try {
      const response = await coinGeckoApi.get('/simple/price', {
        params: {
          ids: cryptoIds.join(','),
          vs_currencies: 'usd',
          include_24hr_change: true,
          include_market_cap: true
        }
      });
      return response.data;
    } catch (error) {
      console.error('Error fetching crypto prices:', error);
      throw new Error('Failed to fetch cryptocurrency prices');
    }
  },

  // Convert USD to cryptocurrency
  async convertUSDToCrypto(usdAmount, cryptoId = 'bitcoin') {
    try {
      const prices = await this.getCryptoPrices([cryptoId]);
      const cryptoPrice = prices[cryptoId]?.usd;
      if (!cryptoPrice) {
        throw new Error(`Price not found for ${cryptoId}`);
      }
      return {
        usdAmount: parseFloat(usdAmount),
        cryptoAmount: parseFloat(usdAmount) / cryptoPrice,
        cryptoPrice,
        cryptoId,
        conversion_rate: 1 / cryptoPrice
      };
    } catch (error) {
      console.error('Error converting USD to crypto:', error);
      throw error;
    }
  },

  // Get list of available cryptocurrencies
  async getCryptoList(limit = 100) {
    try {
      const response = await coinGeckoApi.get('/coins/markets', {
        params: {
          vs_currency: 'usd',
          order: 'market_cap_desc',
          per_page: limit,
          page: 1
        }
      });
      return response.data;
    } catch (error) {
      console.error('Error fetching crypto list:', error);
      throw new Error('Failed to fetch cryptocurrency list');
    }
  }
};

// Google Vision API for object detection
export const visionService = {
  async analyzeImage(imageBase64) {
    try {
      const response = await googleApi.post(
        `https://vision.googleapis.com/v1/images:annotate?key=${GOOGLE_VISION_API_KEY}`,
        {
          requests: [
            {
              image: {
                content: imageBase64
              },
              features: [
                { type: 'LABEL_DETECTION', maxResults: 10 },
                { type: 'TEXT_DETECTION', maxResults: 5 },
                { type: 'LOGO_DETECTION', maxResults: 5 },
                { type: 'OBJECT_LOCALIZATION', maxResults: 10 }
              ]
            }
          ]
        }
      );

      const annotations = response.data.responses[0];
      return {
        labels: annotations.labelAnnotations || [],
        text: annotations.textAnnotations || [],
        logos: annotations.logoAnnotations || [],
        objects: annotations.localizedObjectAnnotations || []
      };
    } catch (error) {
      console.error('Error analyzing image:', error);
      throw new Error('Failed to analyze image');
    }
  }
};

// Enhanced Google Custom Search API for product pricing
export const searchService = {
  // Categorize products for better search terms
  getProductCategory(productName) {
    const categories = {
      household: ['wipes', 'cleaner', 'detergent', 'soap', 'paper towel', 'toilet paper', 'clorox', 'lysol', 'tide', 'bounty'],
      electronics: ['phone', 'laptop', 'tablet', 'headphone', 'speaker', 'camera', 'iphone', 'samsung', 'apple'],
      food: ['coffee', 'tea', 'snack', 'drink', 'food', 'starbucks', 'coca cola'],
      clothing: ['shirt', 'shoe', 'jacket', 'pants', 'dress', 'nike', 'adidas'],
      books: ['book', 'novel', 'textbook', 'magazine'],
      health: ['vitamin', 'medicine', 'supplement', 'lotion', 'shampoo']
    };

    const lowercaseProduct = productName.toLowerCase();
    
    for (const [category, keywords] of Object.entries(categories)) {
      if (keywords.some(keyword => lowercaseProduct.includes(keyword))) {
        return category;
      }
    }
    return 'general';
  },

  // Build better search queries based on product category
  buildSearchQuery(productName, category) {
    const baseSearchTerms = {
      household: `${productName} price walmart target amazon store buy`,
      electronics: `${productName} price best buy amazon walmart cost`,
      food: `${productName} price grocery store walmart target cost`,
      clothing: `${productName} price buy online store cost`,
      books: `${productName} price amazon barnes noble cost`,
      health: `${productName} price pharmacy walmart cvs cost`,
      general: `${productName} price buy online walmart amazon cost`
    };

    return baseSearchTerms[category] || baseSearchTerms.general;
  },

  async searchProductPrice(productName) {
    try {
      const category = this.getProductCategory(productName);
      const query = this.buildSearchQuery(productName, category);
      
      console.log(`Searching for: "${query}" (Category: ${category})`);
      
      const response = await googleApi.get(
        `https://www.googleapis.com/customsearch/v1`,
        {
          params: {
            key: GOOGLE_SEARCH_API_KEY,
            cx: GOOGLE_SEARCH_ENGINE_ID,
            q: query,
            num: 8,
            safe: 'active'
          }
        }
      );

      const searchResults = response.data.items || [];
      console.log(`Found ${searchResults.length} search results`);
      
      return searchResults;
    } catch (error) {
      console.error('Error searching product price:', error);
      throw new Error('Failed to search product price');
    }
  }
};

// Fixed Gemini AI API for enhanced object recognition and price estimation
export const geminiService = {
  async analyzeImageWithGemini(imageBase64, detectedObjects) {
    try {
      const prompt = `
Analyze this image and the detected objects: ${JSON.stringify(detectedObjects)}

Please provide:
1. The most likely product name and brand
2. Estimated price range in USD  
3. Category of the product
4. Confidence level of identification

Return as JSON format:
{
  "product_name": "string",
  "estimated_price_min": number,
  "estimated_price_max": number,
  "category": "string", 
  "confidence": number (0-100)
}
`;

      // Updated API endpoint for Gemini Pro Vision
      const response = await googleApi.post(
        `https://generativelanguage.googleapis.com/v1beta/models/gemini-1.5-flash:generateContent?key=${GEMINI_API_KEY}`,
        {
          contents: [
            {
              parts: [
                { text: prompt },
                {
                  inline_data: {
                    mime_type: "image/jpeg",
                    data: imageBase64
                  }
                }
              ]
            }
          ],
          generationConfig: {
            temperature: 0.4,
            topK: 32,
            topP: 1,
            maxOutputTokens: 4096,
          }
        }
      );

      const generatedText = response.data.candidates[0]?.content?.parts[0]?.text;
      console.log('Gemini raw response:', generatedText);
      
      if (generatedText) {
        // Try to parse JSON from the response
        const jsonMatch = generatedText.match(/\{[\s\S]*\}/);
        if (jsonMatch) {
          try {
            return JSON.parse(jsonMatch[0]);
          } catch (parseError) {
            console.log('JSON parse error, trying to extract info manually');
            return this.fallbackParseResponse(generatedText, detectedObjects);
          }
        }
      }
      
      throw new Error('Invalid response format from Gemini');
    } catch (error) {
      console.error('Error analyzing with Gemini:', error);
      
      // If it's a 403/404 error, likely API key issue
      if (error.response?.status === 403) {
        throw new Error('Gemini API key is invalid or has no quota');
      } else if (error.response?.status === 404) {
        throw new Error('Gemini API endpoint not found - check API key setup');
      }
      
      throw new Error('Failed to analyze with Gemini AI');
    }
  },

  // Fallback parsing if JSON parsing fails
  fallbackParseResponse(text, detectedObjects) {
    // Extract product info manually from text response
    const productNameMatch = text.match(/product[_\s]*name[:\s]*([^\n,]+)/i);
    const priceMinMatch = text.match(/price[_\s]*min[:\s]*(\d+\.?\d*)/i);
    const priceMaxMatch = text.match(/price[_\s]*max[:\s]*(\d+\.?\d*)/i);
    const categoryMatch = text.match(/category[:\s]*([^\n,]+)/i);
    const confidenceMatch = text.match(/confidence[:\s]*(\d+)/i);

    return {
      product_name: productNameMatch?.[1]?.trim() || detectedObjects[0]?.name || 'Unknown Product',
      estimated_price_min: parseFloat(priceMinMatch?.[1]) || 1,
      estimated_price_max: parseFloat(priceMaxMatch?.[1]) || 50,
      category: categoryMatch?.[1]?.trim() || 'general',
      confidence: parseInt(confidenceMatch?.[1]) || 50
    };
  }
};

// Enhanced price extraction utility
export const priceUtils = {
  extractPriceFromText(text) {
    // Enhanced regular expressions to match various price formats
    const pricePatterns = [
      /\$(\d+(?:,\d{3})*(?:\.\d{2})?)/g,                // $12.99, $1,299.99
      /(\d+(?:,\d{3})*(?:\.\d{2})?)\s*(?:USD|dollars?)/gi, // 12.99 USD, 15 dollars
      /price[:\s]*\$?(\d+(?:,\d{3})*(?:\.\d{2})?)/gi,   // Price: $12.99, Price 15.99
      /(\d+\.?\d*)\s*(?:dollar|buck)/gi,                // 12.5 dollars, 15 bucks
      /save.*\$(\d+\.?\d*)/gi,                          // Save $5.00
      /was.*\$(\d+\.?\d*)/gi,                           // Was $15.99
      /from.*\$(\d+\.?\d*)/gi,                          // From $8.99
      /starting.*\$(\d+\.?\d*)/gi,                      // Starting at $6.99
    ];

    const prices = [];
    for (const pattern of pricePatterns) {
      let match;
      while ((match = pattern.exec(text)) !== null) {
        const price = parseFloat(match[1].replace(/,/g, ''));
        if (price > 0.50 && price < 10000) { // Reasonable price range
          prices.push(price);
        }
      }
    }

    return prices.length > 0 ? prices : null;
  },

  // Enhanced price extraction from search results
  extractPricesFromSearchResults(searchResults) {
    const allPrices = [];
    
    searchResults.forEach(result => {
      const text = `${result.title} ${result.snippet}`.toLowerCase();
      const prices = this.extractPriceFromText(text);
      
      if (prices) {
        prices.forEach(price => {
          allPrices.push({
            price: price,
            source: result.title,
            url: result.link
          });
        });
      }
    });

    // If we found prices, return the most reasonable one
    if (allPrices.length > 0) {
      // Sort by price and take median-ish value to avoid extremes
      allPrices.sort((a, b) => a.price - b.price);
      const middleIndex = Math.floor(allPrices.length / 2);
      return allPrices[middleIndex].price;
    }

    return null;
  }
};

export default {
  cryptoService,
  visionService,
  searchService,
  geminiService,
  priceUtils
};