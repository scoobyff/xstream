// Simple test to see if the function works
module.exports = (req, res) => {
  // Set CORS headers
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'GET, POST, OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type');
  
  if (req.method === 'OPTIONS') {
    return res.status(200).end();
  }
  
  // Simple HTML response
  const html = `
  <!DOCTYPE html>
  <html>
  <head>
    <title>Xtream Test</title>
    <meta name="viewport" content="width=device-width, initial-scale=1.0">
  </head>
  <body style="font-family: Arial; padding: 20px; background: #f0f0f0;">
    <div style="max-width: 500px; margin: 0 auto; background: white; padding: 30px; border-radius: 10px;">
      <h1>🎬 Xtream M3U8 Proxy</h1>
      <p>✅ <strong>Success!</strong> Your Vercel function is working!</p>
      
      <form id="testForm" style="margin-top: 30px;">
        <div style="margin-bottom: 15px;">
          <label style="display: block; margin-bottom: 5px; font-weight: bold;">Server URL:</label>
          <input type="url" name="server_url" required 
                 style="width: 100%; padding: 10px; border: 1px solid #ddd; border-radius: 5px;"
                 placeholder="http://your-server.com:8080">
        </div>
        
        <div style="margin-bottom: 15px;">
          <label style="display: block; margin-bottom: 5px; font-weight: bold;">Username:</label>
          <input type="text" name="username" required 
                 style="width: 100%; padding: 10px; border: 1px solid #ddd; border-radius: 5px;"
                 placeholder="your_username">
        </div>
        
        <div style="margin-bottom: 15px;">
          <label style="display: block; margin-bottom: 5px; font-weight: bold;">Password:</label>
          <input type="password" name="password" required 
                 style="width: 100%; padding: 10px; border: 1px solid #ddd; border-radius: 5px;"
                 placeholder="your_password">
        </div>
        
        <div style="margin-bottom: 20px;">
          <label style="display: block; margin-bottom: 5px; font-weight: bold;">Content Type:</label>
          <select name="content_type" required 
                  style="width: 100%; padding: 10px; border: 1px solid #ddd; border-radius: 5px;">
            <option value="">Select Content Type</option>
            <option value="live">Live TV Only</option>
            <option value="movie">Movies/VOD Only</option>
            <option value="both">Both Live TV & Movies</option>
          </select>
        </div>
        
        <button type="submit" 
                style="width: 100%; background: #007bff; color: white; padding: 12px; border: none; border-radius: 5px; font-size: 16px; cursor: pointer;">
          🚀 Test Connection
        </button>
      </form>
      
      <div id="result" style="margin-top: 20px; padding: 15px; border-radius: 5px; display: none;"></div>
    </div>
    
    <script>
      document.getElementById('testForm').addEventListener('submit', function(e) {
        e.preventDefault();
        const result = document.getElementById('result');
        
        result.style.display = 'block';
        result.style.background = '#d1ecf1';
        result.style.color = '#0c5460';
        result.innerHTML = '⏳ Testing connection...';
        
        setTimeout(() => {
          result.style.background = '#d4edda';
          result.style.color = '#155724';
          result.innerHTML = '✅ Form is working! Ready for full implementation.';
        }, 2000);
      });
    </script>
  </body>
  </html>
  `;
  
  res.setHeader('Content-Type', 'text/html');
  return res.status(200).send(html);
};