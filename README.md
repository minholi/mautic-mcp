# Mautic MCP Server

A comprehensive Model Context Protocol (MCP) server that provides full integration with Mautic marketing automation platform.

[![GitHub Stars](https://img.shields.io/github/stars/Cbrown35/mantic-MCP?style=social)](https://github.com/Cbrown35/mantic-MCP/stargazers)
[![GitHub Issues](https://img.shields.io/github/issues/Cbrown35/mantic-MCP)](https://github.com/Cbrown35/mantic-MCP/issues)
[![GitHub License](https://img.shields.io/github/license/Cbrown35/mantic-MCP)](https://github.com/Cbrown35/mantic-MCP/blob/main/LICENSE)

## 🚀 Quick Start

```bash
# Clone and setup
git clone https://github.com/Cbrown35/mantic-MCP.git
cd mantic-MCP
npm install

# Configure your Mautic credentials
cp .env.example .env
# Edit .env with your Mautic API credentials

# Build and run
npm run build
```

Then add the server to your MCP configuration and start using natural language commands like:
- "Search for all contacts with gmail in their email"
- "Create a new contact named John Doe"
- "List all email campaigns"

## Features

This MCP server provides complete access to your Mautic instance with the following capabilities:

### 🔐 Authentication
- OAuth2 authentication with automatic token refresh
- Secure credential management through environment variables

### 👥 Contact Management
- **create_contact** - Create new contacts with custom fields
- **update_contact** - Update existing contact information
- **get_contact** - Retrieve contact details by ID or email
- **search_contacts** - Search contacts with filters and pagination
- **delete_contact** - Remove contacts from Mautic
- **add_contact_to_segment** - Add contacts to specific segments

### 📧 Campaign Management
- **list_campaigns** - Get all campaigns with status and statistics
- **get_campaign** - Get detailed campaign information
- **create_campaign** - Create new campaigns
- **add_contact_to_campaign** - Add contacts to campaigns

### ✉️ Email Operations
- **send_email** - Send emails to specific contacts
- **list_emails** - Get all email templates and campaigns
- **get_email** - Get detailed email information
- **create_email_template** - Create new email templates
- **get_email_stats** - Get email performance statistics

### 📝 Form Management
- **list_forms** - Get all forms with submission counts
- **get_form** - Get form details and fields
- **get_form_submissions** - Get form submission data

### 🎯 Segment Management
- **list_segments** - Get all contact segments
- **create_segment** - Create new contact segments with filters
- **get_segment_contacts** - Get contacts in a specific segment

### 📊 Analytics & Reporting
- **get_contact_activity** - Get contact interaction history
- **get_email_stats** - Get email performance statistics

## Installation

### Prerequisites
- Node.js (v16 or higher)
- npm or yarn
- Access to a Mautic instance with API credentials

### Setup

1. **Clone the repository:**
   ```bash
   git clone https://github.com/Cbrown35/mantic-MCP.git
   cd mantic-MCP
   ```

2. **Install dependencies:**
   ```bash
   npm install
   ```

3. **Configure environment variables:**
   ```bash
   cp .env.example .env
   ```
   Edit `.env` and fill in your Mautic API credentials:
   ```env
   MAUTIC_BASE_URL=https://your-mautic-instance.com/api/
   MAUTIC_CLIENT_ID=your_client_id_here
   MAUTIC_CLIENT_SECRET=your_client_secret_here
   MAUTIC_TOKEN_ENDPOINT=https://your-mautic-instance.com/oauth/v2/token
   ```

4. **Build the server:**
   ```bash
   npm run build
   ```

5. **Configure MCP settings:**
   Add the server to your MCP configuration file:
   ```json
   {
     "mcpServers": {
       "mautic-server": {
         "command": "node",
         "args": ["/path/to/mautic-server/build/index.js"],
         "env": {
           "MAUTIC_BASE_URL": "https://your-mautic-instance.com/api/",
           "MAUTIC_CLIENT_ID": "your_client_id",
           "MAUTIC_CLIENT_SECRET": "your_client_secret",
           "MAUTIC_TOKEN_ENDPOINT": "https://your-mautic-instance.com/oauth/v2/token"
         },
         "disabled": false,
         "autoApprove": []
       }
     }
   }
   ```

## Configuration

### Environment Variables

The server requires the following environment variables:

| Variable | Description | Example |
|----------|-------------|---------|
| `MAUTIC_BASE_URL` | Your Mautic API base URL | `https://your-mautic.com/api/` |
| `MAUTIC_CLIENT_ID` | OAuth2 Client ID | `1_abc123...` |
| `MAUTIC_CLIENT_SECRET` | OAuth2 Client Secret | `secret123...` |
| `MAUTIC_TOKEN_ENDPOINT` | OAuth2 Token Endpoint | `https://your-mautic.com/oauth/v2/token` |

### Obtaining Mautic API Credentials

1. Log into your Mautic instance as an administrator
2. Go to Settings → Configuration → API Settings
3. Enable API access
4. Go to Settings → API Credentials
5. Create a new API credential with OAuth2 authorization
6. Note down the Client ID and Client Secret

## Usage Examples

Once the server is running, you can use it through MCP tool calls:

### Create a Contact
```
Create a new contact with email "john@example.com", first name "John", and last name "Doe"
```

### Search Contacts
```
Search for all contacts with "gmail" in their email address
```

### Send Email
```
Send email template ID 5 to contact ID 123
```

### Get Campaign Statistics
```
Get detailed information for campaign ID 10
```

### List Forms
```
Show me all published forms with their submission counts
```

## API Endpoints

The server connects to your Mautic instance at `https://mailer.dzind.com/api/` and uses the following main endpoints:

- `/contacts` - Contact management
- `/campaigns` - Campaign operations
- `/emails` - Email management
- `/forms` - Form operations
- `/segments` - Segment management

## Error Handling

The server includes comprehensive error handling:
- Automatic OAuth2 token refresh
- Detailed error messages from Mautic API
- Graceful handling of authentication failures
- Retry logic for transient errors

## Security

- All credentials are stored as environment variables
- OAuth2 tokens are automatically refreshed
- No sensitive data is logged or exposed
- Secure HTTPS communication with Mautic API

## Development

To modify or extend the server:

1. Edit the source code in `src/index.ts`
2. Build the server: `npm run build`
3. The server will automatically reload with your changes

## 🚀 Deployment

### Production Deployment

1. **Clone and build:**
   ```bash
   git clone https://github.com/Cbrown35/mantic-MCP.git
   cd mantic-MCP
   npm install
   npm run build
   ```

2. **Set up environment variables** in your production environment
3. **Configure your MCP client** to point to the built server
4. **Monitor logs** for any authentication or API issues

### Docker Deployment (Coming Soon)

Docker support is planned for easier deployment and scaling.

## 🤝 Contributing

We welcome contributions! Here's how to get started:

### Development Setup

1. **Fork the repository** on GitHub
2. **Clone your fork:**
   ```bash
   git clone https://github.com/yourusername/mantic-MCP.git
   cd mantic-MCP
   ```

3. **Create a feature branch:**
   ```bash
   git checkout -b feature/your-feature-name
   ```

4. **Install dependencies:**
   ```bash
   npm install
   ```

5. **Make your changes** and test thoroughly
6. **Build and test:**
   ```bash
   npm run build
   # Test your changes with a real Mautic instance
   ```

7. **Commit and push:**
   ```bash
   git add .
   git commit -m "Add your feature description"
   git push origin feature/your-feature-name
   ```

8. **Create a Pull Request** on GitHub

### Contribution Guidelines

- Follow TypeScript best practices
- Add comprehensive error handling
- Update documentation for new features
- Test with real Mautic instances when possible
- Maintain backward compatibility

### Reporting Issues

Found a bug or have a feature request? Please [open an issue](https://github.com/Cbrown35/mantic-MCP/issues) with:

- Clear description of the problem or feature
- Steps to reproduce (for bugs)
- Your environment details (Node.js version, Mautic version, etc.)
- Expected vs actual behavior

## 📄 License

This project is licensed under the MIT License - see the [LICENSE](LICENSE) file for details.

## 🙏 Acknowledgments

- Built with the [Model Context Protocol SDK](https://github.com/modelcontextprotocol/typescript-sdk)
- Integrates with [Mautic](https://www.mautic.org/) marketing automation platform
- Inspired by the need for seamless marketing automation integration

## Support

This server provides comprehensive integration with Mautic's REST API. For specific API documentation, refer to your Mautic instance's API documentation.

### Getting Help

- 📖 [Documentation](https://github.com/Cbrown35/mantic-MCP/blob/main/README.md)
- 🐛 [Report Issues](https://github.com/Cbrown35/mantic-MCP/issues)
- 💬 [Discussions](https://github.com/Cbrown35/mantic-MCP/discussions)
- 📧 Contact: [Create an issue](https://github.com/Cbrown35/mantic-MCP/issues/new) for support
