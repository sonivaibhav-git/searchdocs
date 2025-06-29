# DeepSearch - Document Search Engine

A comprehensive document search engine with OCR capabilities, built with React, Supabase, and Docker.

## Features

- **Document Upload**: Drag-and-drop interface for PDFs and images
- **OCR Processing**: Automatic text extraction from images using Tesseract.js
- **PDF Text Extraction**: Extract text content from PDF documents
- **Full-Text Search**: Search through document content with highlighting
- **Semantic Search**: AI-powered semantic search using vector embeddings
- **User Authentication**: Secure user accounts with Supabase Auth
- **Document Management**: View, organize, and delete uploaded documents
- **Responsive Design**: Works seamlessly on desktop and mobile devices
- **Docker Support**: Easy deployment with Docker containers

## Tech Stack

- **Frontend**: React 18, TypeScript, Tailwind CSS
- **Backend**: Supabase (PostgreSQL, Auth, Storage)
- **OCR**: Tesseract.js
- **PDF Processing**: PDF-lib
- **File Upload**: React Dropzone
- **Search**: PostgreSQL Full-Text Search + Vector embeddings
- **Deployment**: Docker, Nginx

## Quick Start

### Prerequisites

- Node.js 18+
- Docker (optional)
- Supabase account

### Environment Setup

1. Clone the repository:
```bash
git clone <repository-url>
cd deep-search-engine
```

2. Install dependencies:
```bash
npm install
```

3. Set up environment variables:
```bash
cp .env.example .env
```

4. Add your Supabase credentials to `.env`:
```
VITE_SUPABASE_URL=your_supabase_url
VITE_SUPABASE_ANON_KEY=your_supabase_anon_key
```

5. Run the database migrations in your Supabase dashboard using the SQL from `supabase/migrations/`

6. Start the development server:
```bash
npm run dev
```

## Docker Deployment

### Build and run with Docker:

```bash
# Build the image
docker build -t deepsearch .

# Run the container
docker run -p 3000:80 deepsearch
```

### Using Docker Compose:

```bash
docker-compose up -d
```

The application will be available at `http://localhost:3000`

## Usage

1. **Sign Up/Sign In**: Create an account or sign in to access the application
2. **Upload Documents**: Use the Upload page to drag-and-drop PDFs or images
3. **Search**: Use the Search page to find content across all your documents
4. **Manage**: View and manage your documents in the My Documents section

## Architecture

### Frontend Components

- `AuthForm`: User authentication interface
- `SearchPage`: Document search with filters and results
- `UploadPage`: File upload with progress tracking
- `DocumentsPage`: Document management interface
- `Layout`: Main application layout with navigation

### Backend Services

- **Supabase Database**: PostgreSQL with full-text search indexes
- **Supabase Storage**: File storage for uploaded documents
- **Supabase Auth**: User authentication and authorization
- **Row Level Security**: Ensures users only access their own documents

### Search Features

- **Full-Text Search**: PostgreSQL's built-in text search with ranking
- **Content Highlighting**: Search term highlighting in results
- **File Type Filtering**: Filter by PDF or image documents
- **Sorting Options**: Sort by date, name, or file size

## Development

### Project Structure

```
src/
├── components/          # React components
├── contexts/           # React contexts (Auth)
├── lib/               # Utility libraries (Supabase client)
├── App.tsx            # Main application component
└── main.tsx          # Application entry point

supabase/
└── migrations/       # Database migrations

docker/
├── Dockerfile        # Production Docker image
├── docker-compose.yml # Docker Compose configuration
└── nginx.conf       # Nginx configuration
```

### Database Schema

- `documents`: Stores document metadata and extracted text
- Row Level Security ensures data isolation between users
- Full-text search indexes for efficient content search
- Storage policies for secure file access

## Contributing

1. Fork the repository
2. Create a feature branch
3. Make your changes
4. Add tests if applicable
5. Submit a pull request

## License

MIT License - see LICENSE file for details