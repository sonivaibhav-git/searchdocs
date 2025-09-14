/*
  # Metro Operations Role-Based System

  1. New Tables
    - `roles` - Define system roles
    - `user_roles` - Assign roles to users
    - `document_categories` - Categorize documents by department
    - `document_summaries` - Store AI-generated summaries
    - `dashboard_cards` - Role-specific dashboard content
    - `deadlines` - Track important deadlines
    - `notifications` - Real-time alerts

  2. Security
    - Enable RLS on all new tables
    - Role-based access policies
    - Department-specific data isolation

  3. Functions
    - Role checking functions
    - Dashboard data aggregation
    - Deadline monitoring
*/

-- Create roles table
CREATE TABLE IF NOT EXISTS roles (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  role_name varchar(50) UNIQUE NOT NULL,
  role_code varchar(20) UNIQUE NOT NULL,
  description text,
  permissions jsonb DEFAULT '{}',
  created_at timestamptz DEFAULT now()
);

-- Insert predefined roles
INSERT INTO roles (role_name, role_code, description, permissions) VALUES
('Station Controllers', 'STATION_CTRL', 'Frontline users managing daily operations', '{"incidents": true, "safety": true, "operations": true}'),
('Rolling Stock & Engineering', 'ROLLING_STOCK', 'Maintenance and technical operations', '{"maintenance": true, "engineering": true, "fleet": true}'),
('Procurement & Finance', 'PROCUREMENT', 'Contract and budget management', '{"procurement": true, "finance": true, "contracts": true}'),
('HR', 'HR', 'Human resources and training', '{"hr": true, "training": true, "policies": true}'),
('Safety & Compliance Officers', 'SAFETY', 'Regulatory compliance and safety', '{"safety": true, "compliance": true, "regulatory": true}'),
('Executive Management', 'EXECUTIVE', 'Strategic oversight and reporting', '{"executive": true, "reports": true, "all_departments": true}')
ON CONFLICT (role_code) DO NOTHING;

-- Create user_roles table
CREATE TABLE IF NOT EXISTS user_roles (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid REFERENCES user_profiles(user_id) ON DELETE CASCADE,
  role_id uuid REFERENCES roles(id) ON DELETE CASCADE,
  assigned_at timestamptz DEFAULT now(),
  assigned_by uuid REFERENCES user_profiles(user_id),
  is_active boolean DEFAULT true,
  UNIQUE(user_id, role_id)
);

-- Create document_categories table
CREATE TABLE IF NOT EXISTS document_categories (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  category_name varchar(50) NOT NULL,
  category_code varchar(20) UNIQUE NOT NULL,
  target_roles text[] DEFAULT '{}',
  priority_level integer DEFAULT 1,
  color_code varchar(7) DEFAULT '#3B82F6',
  created_at timestamptz DEFAULT now()
);

-- Insert document categories
INSERT INTO document_categories (category_name, category_code, target_roles, priority_level, color_code) VALUES
('Incident Reports', 'INCIDENT', '{"STATION_CTRL", "SAFETY", "EXECUTIVE"}', 5, '#EF4444'),
('Safety Circulars', 'SAFETY', '{"STATION_CTRL", "SAFETY", "EXECUTIVE"}', 4, '#F59E0B'),
('Maintenance Cards', 'MAINTENANCE', '{"ROLLING_STOCK", "EXECUTIVE"}', 3, '#10B981'),
('Procurement Documents', 'PROCUREMENT', '{"PROCUREMENT", "EXECUTIVE"}', 2, '#8B5CF6'),
('HR Policies', 'HR_POLICY', '{"HR", "EXECUTIVE"}', 2, '#06B6D4'),
('Regulatory Directives', 'REGULATORY', '{"SAFETY", "EXECUTIVE"}', 5, '#DC2626'),
('Training Materials', 'TRAINING', '{"HR", "STATION_CTRL", "ROLLING_STOCK", "SAFETY"}', 3, '#059669'),
('Financial Reports', 'FINANCIAL', '{"PROCUREMENT", "EXECUTIVE"}', 3, '#7C3AED')
ON CONFLICT (category_code) DO NOTHING;

-- Add category and summary fields to documents table
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_name = 'documents' AND column_name = 'category_id'
  ) THEN
    ALTER TABLE documents ADD COLUMN category_id uuid REFERENCES document_categories(id);
  END IF;

  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_name = 'documents' AND column_name = 'summary'
  ) THEN
    ALTER TABLE documents ADD COLUMN summary text;
  END IF;

  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_name = 'documents' AND column_name = 'severity_level'
  ) THEN
    ALTER TABLE documents ADD COLUMN severity_level integer DEFAULT 1;
  END IF;

  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_name = 'documents' AND column_name = 'deadline'
  ) THEN
    ALTER TABLE documents ADD COLUMN deadline timestamptz;
  END IF;

  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_name = 'documents' AND column_name = 'status'
  ) THEN
    ALTER TABLE documents ADD COLUMN status varchar(20) DEFAULT 'active';
  END IF;
END $$;

-- Create document_summaries table for role-specific summaries
CREATE TABLE IF NOT EXISTS document_summaries (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  document_id uuid REFERENCES documents(id) ON DELETE CASCADE,
  role_code varchar(20) REFERENCES roles(role_code),
  summary_text text NOT NULL,
  key_points jsonb DEFAULT '[]',
  action_items jsonb DEFAULT '[]',
  priority_score integer DEFAULT 1,
  generated_at timestamptz DEFAULT now(),
  UNIQUE(document_id, role_code)
);

-- Create dashboard_cards table
CREATE TABLE IF NOT EXISTS dashboard_cards (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  role_code varchar(20) REFERENCES roles(role_code),
  card_type varchar(30) NOT NULL,
  title varchar(100) NOT NULL,
  content jsonb DEFAULT '{}',
  priority integer DEFAULT 1,
  is_active boolean DEFAULT true,
  created_at timestamptz DEFAULT now(),
  updated_at timestamptz DEFAULT now()
);

-- Create notifications table
CREATE TABLE IF NOT EXISTS notifications (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid REFERENCES user_profiles(user_id) ON DELETE CASCADE,
  title varchar(200) NOT NULL,
  message text NOT NULL,
  type varchar(20) DEFAULT 'info',
  is_read boolean DEFAULT false,
  document_id uuid REFERENCES documents(id) ON DELETE SET NULL,
  created_at timestamptz DEFAULT now(),
  expires_at timestamptz
);

-- Enable RLS on all new tables
ALTER TABLE roles ENABLE ROW LEVEL SECURITY;
ALTER TABLE user_roles ENABLE ROW LEVEL SECURITY;
ALTER TABLE document_categories ENABLE ROW LEVEL SECURITY;
ALTER TABLE document_summaries ENABLE ROW LEVEL SECURITY;
ALTER TABLE dashboard_cards ENABLE ROW LEVEL SECURITY;
ALTER TABLE notifications ENABLE ROW LEVEL SECURITY;

-- Create RLS policies for roles (readable by all authenticated users)
CREATE POLICY "All users can view roles"
  ON roles FOR SELECT TO authenticated USING (true);

-- Create RLS policies for user_roles
CREATE POLICY "Users can view own roles"
  ON user_roles FOR SELECT TO authenticated 
  USING (user_id = auth.uid());

CREATE POLICY "Admins can manage user roles"
  ON user_roles FOR ALL TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM user_roles ur 
      JOIN roles r ON ur.role_id = r.id 
      WHERE ur.user_id = auth.uid() AND r.role_code = 'EXECUTIVE'
    )
  );

-- Create RLS policies for document_categories
CREATE POLICY "All users can view document categories"
  ON document_categories FOR SELECT TO authenticated USING (true);

-- Create RLS policies for document_summaries
CREATE POLICY "Users can view summaries for their roles"
  ON document_summaries FOR SELECT TO authenticated
  USING (
    role_code IN (
      SELECT r.role_code FROM user_roles ur 
      JOIN roles r ON ur.role_id = r.id 
      WHERE ur.user_id = auth.uid() AND ur.is_active = true
    )
  );

-- Create RLS policies for dashboard_cards
CREATE POLICY "Users can view cards for their roles"
  ON dashboard_cards FOR SELECT TO authenticated
  USING (
    role_code IN (
      SELECT r.role_code FROM user_roles ur 
      JOIN roles r ON ur.role_id = r.id 
      WHERE ur.user_id = auth.uid() AND ur.is_active = true
    )
  );

-- Create RLS policies for notifications
CREATE POLICY "Users can view own notifications"
  ON notifications FOR SELECT TO authenticated 
  USING (user_id = auth.uid());

CREATE POLICY "Users can update own notifications"
  ON notifications FOR UPDATE TO authenticated 
  USING (user_id = auth.uid());

-- Update documents RLS policy to include role-based access
DROP POLICY IF EXISTS "Users can view own and public documents" ON documents;

CREATE POLICY "Users can view role-appropriate documents"
  ON documents FOR SELECT TO authenticated
  USING (
    user_id = auth.uid() OR 
    is_public = true OR
    (
      category_id IN (
        SELECT dc.id FROM document_categories dc
        JOIN user_roles ur ON auth.uid() = ur.user_id
        JOIN roles r ON ur.role_id = r.id
        WHERE r.role_code = ANY(dc.target_roles) AND ur.is_active = true
      )
    )
  );

-- Function to get user roles
CREATE OR REPLACE FUNCTION get_user_roles(user_uuid uuid)
RETURNS TABLE(role_code varchar, role_name varchar, permissions jsonb)
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
BEGIN
  RETURN QUERY
  SELECT r.role_code, r.role_name, r.permissions
  FROM user_roles ur
  JOIN roles r ON ur.role_id = r.id
  WHERE ur.user_id = user_uuid AND ur.is_active = true;
END;
$$;

-- Function to check if user has specific role
CREATE OR REPLACE FUNCTION user_has_role(user_uuid uuid, role_code_param varchar)
RETURNS boolean
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
BEGIN
  RETURN EXISTS (
    SELECT 1 FROM user_roles ur
    JOIN roles r ON ur.role_id = r.id
    WHERE ur.user_id = user_uuid 
    AND r.role_code = role_code_param 
    AND ur.is_active = true
  );
END;
$$;

-- Function to get dashboard data for a role
CREATE OR REPLACE FUNCTION get_dashboard_data(role_code_param varchar)
RETURNS TABLE(
  card_type varchar,
  title varchar,
  content jsonb,
  priority integer,
  document_count bigint,
  urgent_count bigint
)
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
BEGIN
  RETURN QUERY
  SELECT 
    dc.card_type,
    dc.title,
    dc.content,
    dc.priority,
    COUNT(d.id) as document_count,
    COUNT(CASE WHEN d.deadline <= now() + interval '7 days' THEN 1 END) as urgent_count
  FROM dashboard_cards dc
  LEFT JOIN document_categories cat ON cat.target_roles @> ARRAY[role_code_param]
  LEFT JOIN documents d ON d.category_id = cat.id AND d.status = 'active'
  WHERE dc.role_code = role_code_param AND dc.is_active = true
  GROUP BY dc.id, dc.card_type, dc.title, dc.content, dc.priority
  ORDER BY dc.priority DESC, dc.created_at;
END;
$$;

-- Function to create notification
CREATE OR REPLACE FUNCTION create_notification(
  user_uuid uuid,
  title_param varchar,
  message_param text,
  type_param varchar DEFAULT 'info',
  document_uuid uuid DEFAULT NULL
)
RETURNS uuid
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
DECLARE
  notification_id uuid;
BEGIN
  INSERT INTO notifications (user_id, title, message, type, document_id)
  VALUES (user_uuid, title_param, message_param, type_param, document_uuid)
  RETURNING id INTO notification_id;
  
  RETURN notification_id;
END;
$$;

-- Create indexes for performance
CREATE INDEX IF NOT EXISTS idx_user_roles_user_id ON user_roles(user_id);
CREATE INDEX IF NOT EXISTS idx_user_roles_role_id ON user_roles(role_id);
CREATE INDEX IF NOT EXISTS idx_documents_category_id ON documents(category_id);
CREATE INDEX IF NOT EXISTS idx_documents_deadline ON documents(deadline);
CREATE INDEX IF NOT EXISTS idx_documents_severity ON documents(severity_level);
CREATE INDEX IF NOT EXISTS idx_document_summaries_document_role ON document_summaries(document_id, role_code);
CREATE INDEX IF NOT EXISTS idx_notifications_user_unread ON notifications(user_id, is_read);
CREATE INDEX IF NOT EXISTS idx_dashboard_cards_role ON dashboard_cards(role_code, is_active);

-- Grant permissions
GRANT EXECUTE ON FUNCTION get_user_roles(uuid) TO authenticated;
GRANT EXECUTE ON FUNCTION user_has_role(uuid, varchar) TO authenticated;
GRANT EXECUTE ON FUNCTION get_dashboard_data(varchar) TO authenticated;
GRANT EXECUTE ON FUNCTION create_notification(uuid, varchar, text, varchar, uuid) TO authenticated;