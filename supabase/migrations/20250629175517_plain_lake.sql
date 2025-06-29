/*
  # Create Separate Storage Buckets for Different File Types

  1. Storage Buckets
    - `pdf-documents` - For PDF files
    - `image-documents` - For image files (JPG, PNG, GIF, TIFF, etc.)

  2. Storage Policies
    - Separate policies for each bucket
    - Users can only access their own files
    - Public read access for public documents

  3. Benefits
    - Better organization
    - Easier file type handling
    - Improved performance
    - Better caching strategies per file type
*/

-- Create PDF documents bucket
INSERT INTO storage.buckets (id, name, public, file_size_limit, allowed_mime_types) 
VALUES (
  'pdf-documents', 
  'pdf-documents', 
  true, 
  52428800, -- 50MB limit
  ARRAY['application/pdf']
)
ON CONFLICT (id) DO UPDATE SET
  file_size_limit = 52428800,
  allowed_mime_types = ARRAY['application/pdf'];

-- Create image documents bucket
INSERT INTO storage.buckets (id, name, public, file_size_limit, allowed_mime_types) 
VALUES (
  'image-documents', 
  'image-documents', 
  true, 
  52428800, -- 50MB limit
  ARRAY['image/jpeg', 'image/jpg', 'image/png', 'image/gif', 'image/bmp', 'image/tiff', 'image/webp']
)
ON CONFLICT (id) DO UPDATE SET
  file_size_limit = 52428800,
  allowed_mime_types = ARRAY['image/jpeg', 'image/jpg', 'image/png', 'image/gif', 'image/bmp', 'image/tiff', 'image/webp'];

-- Remove old policies for the general documents bucket
DROP POLICY IF EXISTS "Users can upload documents" ON storage.objects;
DROP POLICY IF EXISTS "Users can view own documents" ON storage.objects;
DROP POLICY IF EXISTS "Users can delete own documents" ON storage.objects;

-- Create storage policies for PDF documents bucket
CREATE POLICY "Users can upload PDF documents"
  ON storage.objects
  FOR INSERT
  TO authenticated
  WITH CHECK (
    bucket_id = 'pdf-documents' AND 
    auth.uid()::text = (storage.foldername(name))[1]
  );

CREATE POLICY "Users can view PDF documents"
  ON storage.objects
  FOR SELECT
  TO authenticated
  USING (
    bucket_id = 'pdf-documents' AND 
    auth.uid()::text = (storage.foldername(name))[1]
  );

CREATE POLICY "Users can delete PDF documents"
  ON storage.objects
  FOR DELETE
  TO authenticated
  USING (
    bucket_id = 'pdf-documents' AND 
    auth.uid()::text = (storage.foldername(name))[1]
  );

-- Create storage policies for image documents bucket
CREATE POLICY "Users can upload image documents"
  ON storage.objects
  FOR INSERT
  TO authenticated
  WITH CHECK (
    bucket_id = 'image-documents' AND 
    auth.uid()::text = (storage.foldername(name))[1]
  );

CREATE POLICY "Users can view image documents"
  ON storage.objects
  FOR SELECT
  TO authenticated
  USING (
    bucket_id = 'image-documents' AND 
    auth.uid()::text = (storage.foldername(name))[1]
  );

CREATE POLICY "Users can delete image documents"
  ON storage.objects
  FOR DELETE
  TO authenticated
  USING (
    bucket_id = 'image-documents' AND 
    auth.uid()::text = (storage.foldername(name))[1]
  );

-- Create public access policies for public documents
CREATE POLICY "Public can view public PDF documents"
  ON storage.objects
  FOR SELECT
  TO public
  USING (bucket_id = 'pdf-documents');

CREATE POLICY "Public can view public image documents"
  ON storage.objects
  FOR SELECT
  TO public
  USING (bucket_id = 'image-documents');