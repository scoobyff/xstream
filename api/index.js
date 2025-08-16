// api/index.js - M3U8 Proxy Service for Vercel
const https = require('https');
const http = require('http');
const { URL } = require('url');

// CORS headers
const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Methods': 'GET, POST, OPTIONS',
  'Access-Control-Allow-Headers': 'Content-Type, Authorization',
};

// In-memory storage for user credentials (you might want to use a database in production)
const userSessions = new Map();

// Helper function to make HTTP requests
function makeRequest(url, options = {}) {
  return new Promise((resolve, reject) => {
    const urlObj = new URL(url);
    const protocol = urlObj.protocol === 'https:' ? https : http;
    
    const requestOptions = {
      hostname: urlObj.hostname,
      port: urlObj.port,
      path: urlObj.pathname + urlObj.search,
      method: options.method || 'GET',
      timeout: 30000,
      headers: {
        'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36',
        ...options.headers
      }
    };

    const req = protocol.request(requestOptions, (res) => {
      let data = '';
      
      res.on('data', (chunk) => {
        data += chunk;
      });
      
      res.on('end', () => {
        resolve({
          statusCode: res.statusCode,
          headers: res.headers,
          data: data
        });
      });
    });

    req.on('error', (error) => {
      reject(error);
    });

    req.on('timeout', () => {
      req.destroy();
      reject(new Error('Request timeout'));
    });

    if (options.body) {
      req.write(options.body);
    }

    req.end();
  });
}

// Get Xtream API data
async function getXtreamData(baseUrl, username, password, type) {
  const apiUrl = `${baseUrl}/player_api.php?username=${username}&password=${password}&action=${type}`;
  
  try {
    const response = await makeRequest(apiUrl);
    if (response.statusCode >= 200 && response.statusCode < 300) {
      return JSON.parse(response.data);
    } else {
      throw new Error(`HTTP ${response.statusCode}`);
    }
  } catch (error) {
    throw new Error(`Failed to fetch ${type}: ${error.message}`);
  }
}

// Proxy M3U8 stream
async function proxyStream(originalUrl) {
  try {
    const response = await makeRequest(originalUrl);
    return {
      statusCode: response.statusCode,
      headers: response.headers,
      data: response.data
    };
  } catch (error) {
    throw new Error(`Failed to proxy stream: ${error.message}`);
  }
}

// Generate session token
function generateSessionToken() {
  return Math.random().toString(36).substring(2, 15) + Math.random().toString(36).substring(2, 15);
}

// Main handler
module.exports = async (req, res) => {
  // Handle CORS preflight
  if (req.method === 'OPTIONS') {
    Object.keys(corsHeaders).forEach(key => {
      res.setHeader(key, corsHeaders[key]);
    });
    return res.status(200).json({ message: 'OK' });
  }

  // Set CORS headers
  Object.keys(corsHeaders).forEach(key => {
    res.setHeader(key, corsHeaders[key]);
  });

  const url = new URL(req.url, `https://${req.headers.host}`);
  const pathname = url.pathname;
  const searchParams = url.searchParams;

  // Route: GET /12345.m3u8 - Stream individual channel
  if (pathname.match(/^\/(\d+)\.m3u8$/)) {
    const streamId = pathname.match(/^\/(\d+)\.m3u8$/)[1];
    const sessionToken = searchParams.get('token');
    const type = searchParams.get('type') || 'live'; // live or movie
    
    if (!sessionToken || !userSessions.has(sessionToken)) {
      return res.status(401).json({ error: 'Invalid or expired session token' });
    }
    
    const userCredentials = userSessions.get(sessionToken);
    const { server_url, username, password } = userCredentials;
    
    try {
      let originalUrl;
      if (type === 'live') {
        originalUrl = `${server_url}/live/${username}/${password}/${streamId}.m3u8`;
      } else if (type === 'movie') {
        originalUrl = `${server_url}/movie/${username}/${password}/${streamId}.m3u8`;
      } else {
        return res.status(400).json({ error: 'Invalid stream type' });
      }
      
      const streamResponse = await proxyStream(originalUrl);
      
      // Set appropriate headers for M3U8
      res.setHeader('Content-Type', 'application/vnd.apple.mpegurl');
      res.setHeader('Access-Control-Allow-Origin', '*');
      return res.status(streamResponse.statusCode).send(streamResponse.data);
      
    } catch (error) {
      return res.status(500).json({ error: `Stream error: ${error.message}` });
    }
  }

  // Route: GET /playlist.m3u8?id=12345 - Stream individual channel (alternative format)
  if (pathname === '/playlist.m3u8' && searchParams.has('id')) {
    const streamId = searchParams.get('id');
    const sessionToken = searchParams.get('token');
    const type = searchParams.get('type') || 'live';
    
    if (!sessionToken || !userSessions.has(sessionToken)) {
      return res.status(401).json({ error: 'Invalid or expired session token' });
    }
    
    const userCredentials = userSessions.get(sessionToken);
    const { server_url, username, password } = userCredentials;
    
    try {
      let originalUrl;
      if (type === 'live') {
        originalUrl = `${server_url}/live/${username}/${password}/${streamId}.m3u8`;
      } else if (type === 'movie') {
        originalUrl = `${server_url}/movie/${username}/${password}/${streamId}.m3u8`;
      }
      
      const streamResponse = await proxyStream(originalUrl);
      
      res.setHeader('Content-Type', 'application/vnd.apple.mpegurl');
      res.setHeader('Access-Control-Allow-Origin', '*');
      return res.status(streamResponse.statusCode).send(streamResponse.data);
      
    } catch (error) {
      return res.status(500).json({ error: `Stream error: ${error.message}` });
    }
  }

  // Route: GET / - Serve HTML form
  if (req.method === 'GET' && pathname === '/') {
    const html = `
    <!DOCTYPE html>
    <html lang="en">
    <head>
        <meta charset="UTF-8">
        <meta name="viewport" content="width=device-width, initial-scale=1.0">
        <title>Xtream to M3U8 Proxy Service</title>
        <style>
            * {
                margin: 0;
                padding: 0;
                box-sizing: border-box;
            }
            
            body {
                font-family: 'Segoe UI', Tahoma, Geneva, Verdana, sans-serif;
                background: linear-gradient(135deg, #667eea 0%, #764ba2 100%);
                min-height: 100vh;
                display: flex;
                align-items: center;
                justify-content: center;
                padding: 20px;
            }
            
            .container {
                background: white;
                padding: 40px;
                border-radius: 15px;
                box-shadow: 0 20px 40px rgba(0,0,0,0.1);
                width: 100%;
                max-width: 600px;
            }
            
            .header {
                text-align: center;
                margin-bottom: 30px;
            }
            
            .header h1 {
                color: #333;
                font-size: 28px;
                margin-bottom: 10px;
            }
            
            .header p {
                color: #666;
                font-size: 14px;
            }
            
            .form-group {
                margin-bottom: 20px;
            }
            
            label {
                display: block;
                margin-bottom: 8px;
                font-weight: 600;
                color: #333;
                font-size: 14px;
            }
            
            input, select {
                width: 100%;
                padding: 12px 15px;
                border: 2px solid #e1e5e9;
                border-radius: 8px;
                font-size: 14px;
                transition: border-color 0.3s ease;
                background: #f8f9fa;
            }
            
            input:focus, select:focus {
                outline: none;
                border-color: #667eea;
                background: white;
            }
            
            .btn {
                width: 100%;
                background: linear-gradient(135deg, #667eea 0%, #764ba2 100%);
                color: white;
                border: none;
                padding: 15px;
                border-radius: 8px;
                font-size: 16px;
                font-weight: 600;
                cursor: pointer;
                transition: transform 0.2s ease;
                margin-bottom: 10px;
            }
            
            .btn:hover {
                transform: translateY(-2px);
            }
            
            .btn:disabled {
                opacity: 0.7;
                cursor: not-allowed;
                transform: none;
            }
            
            .btn.secondary {
                background: linear-gradient(135deg, #28a745 0%, #20c997 100%);
            }
            
            .loading {
                display: none;
                text-align: center;
                margin-top: 20px;
            }
            
            .spinner {
                display: inline-block;
                width: 20px;
                height: 20px;
                border: 3px solid #f3f3f3;
                border-top: 3px solid #667eea;
                border-radius: 50%;
                animation: spin 1s linear infinite;
            }
            
            @keyframes spin {
                0% { transform: rotate(0deg); }
                100% { transform: rotate(360deg); }
            }
            
            .result {
                margin-top: 20px;
                padding: 15px;
                border-radius: 8px;
                display: none;
            }
            
            .result.success {
                background: #d4edda;
                border: 1px solid #c3e6cb;
                color: #155724;
            }
            
            .result.error {
                background: #f8d7da;
                border: 1px solid #f5c6cb;
                color: #721c24;
            }
            
            .channels-list {
                max-height: 300px;
                overflow-y: auto;
                border: 1px solid #ddd;
                border-radius: 8px;
                padding: 10px;
                margin-top: 15px;
                background: #f8f9fa;
            }
            
            .channel-item {
                padding: 8px;
                margin-bottom: 5px;
                background: white;
                border-radius: 5px;
                display: flex;
                justify-content: space-between;
                align-items: center;
                font-size: 12px;
            }
            
            .channel-url {
                font-family: monospace;
                background: #f1f3f4;
                padding: 2px 6px;
                border-radius: 3px;
                font-size: 11px;
                color: #1a73e8;
                word-break: break-all;
            }
            
            .copy-btn {
                background: #1a73e8;
                color: white;
                border: none;
                padding: 4px 8px;
                border-radius: 3px;
                font-size: 10px;
                cursor: pointer;
                margin-left: 10px;
            }
            
            .example {
                font-size: 12px;
                color: #888;
                margin-top: 5px;
                font-style: italic;
            }
        </style>
    </head>
    <body>
        <div class="container">
            <div class="header">
                <h1>🎬 Xtream M3U8 Proxy</h1>
                <p>Convert Xtream URLs to your own domain M3U8 streams</p>
            </div>
            
            <form id="converterForm">
                <div class="form-group">
                    <label for="server_url">Server URL *</label>
                    <input type="url" id="server_url" name="server_url" required placeholder="http://your-server.com:8080">
                    <div class="example">Example: http://server.com:8080</div>
                </div>
                
                <div class="form-group">
                    <label for="username">Username *</label>
                    <input type="text" id="username" name="username" required placeholder="your_username">
                </div>
                
                <div class="form-group">
                    <label for="password">Password *</label>
                    <input type="password" id="password" name="password" required placeholder="your_password">
                </div>
                
                <div class="form-group">
                    <label for="content_type">Content Type *</label>
                    <select id="content_type" name="content_type" required>
                        <option value="">Select Content Type</option>
                        <option value="live">Live TV Only</option>
                        <option value="movie">Movies/VOD Only</option>
                        <option value="both">Both Live TV & Movies</option>
                    </select>
                </div>
                
                <button type="submit" class="btn" id="submitBtn">
                    🚀 Generate Proxy URLs
                </button>
                
                <button type="button" class="btn secondary" id="downloadBtn" style="display:none;">
                    📥 Download M3U Playlist
                </button>
                
                <div class="loading" id="loading">
                    <div class="spinner"></div>
                    <p>Processing your request...</p>
                </div>
                
                <div class="result" id="result"></div>
            </form>
        </div>
        
        <script>
            let currentSessionToken = null;
            let currentM3UContent = null;
            
            document.getElementById('converterForm').addEventListener('submit', async function(e) {
                e.preventDefault();
                
                const submitBtn = document.getElementById('submitBtn');
                const downloadBtn = document.getElementById('downloadBtn');
                const loading = document.getElementById('loading');
                const result = document.getElementById('result');
                
                // Show loading state
                submitBtn.disabled = true;
                downloadBtn.style.display = 'none';
                loading.style.display = 'block';
                result.style.display = 'none';
                
                // Get form data
                const formData = new FormData(this);
                const data = Object.fromEntries(formData.entries());
                
                try {
                    const response = await fetch('/api/generate', {
                        method: 'POST',
                        headers: {
                            'Content-Type': 'application/json',
                        },
                        body: JSON.stringify(data)
                    });
                    
                    const responseData = await response.json();
                    
                    if (response.ok) {
                        currentSessionToken = responseData.sessionToken;
                        currentM3UContent = responseData.m3uPlaylist;
                        
                        result.className = 'result success';
                        result.innerHTML = \`
                            <h3>✅ Success! Generated \${responseData.channelCount} channels</h3>
                            <p><strong>Session Token:</strong> <code>\${responseData.sessionToken}</code></p>
                            <p><strong>Session Expires:</strong> In 24 hours</p>
                            
                            <div class="channels-list">
                                \${responseData.channels.map(channel => \`
                                    <div class="channel-item">
                                        <div>
                                            <strong>\${channel.name}</strong><br>
                                            <span class="channel-url">\${channel.url}</span>
                                        </div>
                                        <button class="copy-btn" onclick="copyToClipboard('\${channel.url}')">Copy</button>
                                    </div>
                                \`).join('')}
                            </div>
                            
                            <h4 style="margin-top: 20px;">URL Formats:</h4>
                            <p><strong>Format 1:</strong> <code>https://your-domain.vercel.app/STREAM_ID.m3u8?token=TOKEN&type=TYPE</code></p>
                            <p><strong>Format 2:</strong> <code>https://your-domain.vercel.app/playlist.m3u8?id=STREAM_ID&token=TOKEN&type=TYPE</code></p>
                        \`;
                        result.style.display = 'block';
                        downloadBtn.style.display = 'block';
                    } else {
                        result.className = 'result error';
                        result.innerHTML = '❌ ' + (responseData.error || 'An error occurred');
                        result.style.display = 'block';
                    }
                } catch (error) {
                    result.className = 'result error';
                    result.innerHTML = '❌ Network error: ' + error.message;
                    result.style.display = 'block';
                } finally {
                    // Hide loading state
                    submitBtn.disabled = false;
                    loading.style.display = 'none';
                }
            });
            
            document.getElementById('downloadBtn').addEventListener('click', function() {
                if (currentM3UContent) {
                    const blob = new Blob([currentM3UContent], { type: 'application/octet-stream' });
                    const url = window.URL.createObjectURL(blob);
                    const a = document.createElement('a');
                    a.style.display = 'none';
                    a.href = url;
                    a.download = 'playlist.m3u';
                    document.body.appendChild(a);
                    a.click();
                    window.URL.revokeObjectURL(url);
                }
            });
            
            function copyToClipboard(text) {
                navigator.clipboard.writeText(text).then(function() {
                    // You could add a toast notification here
                    console.log('URL copied to clipboard');
                });
            }
        </script>
    </body>
    </html>
    `;
    
    res.setHeader('Content-Type', 'text/html');
    return res.status(200).send(html);
  }

  // Route: POST /api/generate - Generate session and proxy URLs
  if (req.method === 'POST' && pathname === '/api/generate') {
    try {
      const { server_url, username, password, content_type } = req.body;

      // Validate required fields
      if (!server_url || !username || !password || !content_type) {
        return res.status(400).json({ error: 'Missing required fields' });
      }

      // Clean server URL
      const baseUrl = server_url.replace(/\/+$/, '');
      
      // Get user info first to validate credentials
      const userInfo = await getXtreamData(baseUrl, username, password, 'get_user_info');
      
      if (!userInfo.user_info || !userInfo.server_info) {
        return res.status(401).json({ error: 'Invalid credentials or server response' });
      }

      // Generate session token
      const sessionToken = generateSessionToken();
      
            // Store user credentials with expiration (24 hours)
      const expiresAt = Date.now() + (24 * 60 * 60 * 1000);
      userSessions.set(sessionToken, {
        server_url: baseUrl,
        username,
        password,
        expires: expiresAt
      });

      let allChannels = [];
      let channelCount = 0;

      // Get Live TV channels
      if (content_type === 'live' || content_type === 'both') {
        try {
          const liveChannels = await getXtreamData(baseUrl, username, password, 'get_live_streams');
          if (Array.isArray(liveChannels)) {
            allChannels = allChannels.concat(liveChannels.map(ch => ({...ch, type: 'live'})));
            channelCount += liveChannels.length;
          }
        } catch (error) {
          console.error('Error getting live channels:', error.message);
        }
      }

      // Get VOD/Movies
      if (content_type === 'movie' || content_type === 'both') {
        try {
          const movies = await getXtreamData(baseUrl, username, password, 'get_vod_streams');
          if (Array.isArray(movies)) {
            allChannels = allChannels.concat(movies.map(mv => ({...mv, type: 'movie'})));
            channelCount += movies.length;
          }
        } catch (error) {
          console.error('Error getting movies:', error.message);
        }
      }

      if (allChannels.length === 0) {
        return res.status(404).json({ error: 'No channels found' });
      }

      // Generate proxy URLs for each channel
      const baseProxyUrl = `https://${req.headers.host}`;
      const channels = allChannels.slice(0, 50).map(channel => ({ // Limit to first 50 for display
        name: channel.name || 'Unknown',
        stream_id: channel.stream_id,
        type: channel.type,
        url: `${baseProxyUrl}/${channel.stream_id}.m3u8?token=${sessionToken}&type=${channel.type}`
      }));

      // Generate M3U playlist content
      let m3uContent = '#EXTM3U\n';
      allChannels.forEach(channel => {
        if (channel.type === 'live') {
          const tvgId = channel.epg_channel_id || channel.stream_id || '';
          const tvgName = (channel.name || 'Unknown Channel').replace(/[",]/g, '');
          const groupTitle = (channel.category_name || 'Uncategorized').replace(/[",]/g, '');
          const logo = channel.stream_icon || '';
          
          m3uContent += `#EXTINF:-1 tvg-id="${tvgId}" tvg-name="${tvgName}" tvg-logo="${logo}" group-title="${groupTitle}",${tvgName}\n`;
          m3uContent += `${baseProxyUrl}/${channel.stream_id}.m3u8?token=${sessionToken}&type=live\n`;
        } else if (channel.type === 'movie') {
          const movieName = (channel.name || 'Unknown Movie').replace(/[",]/g, '');
          const groupTitle = (channel.category_name || 'Movies').replace(/[",]/g, '');
          const logo = channel.stream_icon || '';
          
          m3uContent += `#EXTINF:-1 tvg-logo="${logo}" group-title="${groupTitle}",${movieName}\n`;
          m3uContent += `${baseProxyUrl}/${channel.stream_id}.m3u8?token=${sessionToken}&type=movie\n`;
        }
      });

      return res.status(200).json({
        success: true,
        sessionToken,
        channelCount: allChannels.length,
        channels: channels,
        m3uPlaylist: m3uContent,
        expiresAt: new Date(expiresAt).toISOString()
      });

    } catch (error) {
      console.error('Error processing request:', error);
      return res.status(500).json({ 
        error: 'Failed to process request: ' + error.message 
      });
    }
  }

  // Clean up expired sessions periodically
  for (const [token, session] of userSessions.entries()) {
    if (Date.now() > session.expires) {
      userSessions.delete(token);
    }
  }

  // Method not allowed or route not found
  return res.status(404).json({ error: 'Route not found' });
};
