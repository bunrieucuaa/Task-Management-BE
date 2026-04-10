-- Put your database schema here.
-- This file is executed automatically by the Postgres image
-- ONLY on first initialization of the database volume.

--ENUM

CREATE TYPE user_role AS ENUM (
'ADMIN',
'MEMBER'
);

CREATE TYPE user_status AS ENUM (
'ACTIVE',
'INACTIVE',
'BLOCKED'
);

CREATE TYPE project_status AS ENUM (
'ACTIVE',
'ARCHIVED'
);

CREATE TYPE task_status AS ENUM (
'TODO',
'IN_PROGRESS',
'REVIEW',
'DONE',
'CANCELLED'
);

CREATE TYPE task_priority AS ENUM (
'LOW',
'MEDIUM',
'HIGH',
'URGENT'
);

CREATE TYPE ai_action_type AS ENUM (
'GENERATE_SUBTASKS',
'SUMMARIZE_TASK',
'SUGGEST_PRIORITY',
'SUGGEST_DEADLINE'
);

--Users
CREATE TABLE users (

id SERIAL PRIMARY KEY,

name VARCHAR(100) NOT NULL,

email VARCHAR(255) UNIQUE NOT NULL,

password_hash TEXT NOT NULL,

avatar_url TEXT,

role user_role DEFAULT 'MEMBER',

status user_status DEFAULT 'ACTIVE',

created_at TIMESTAMP DEFAULT now(),

updated_at TIMESTAMP DEFAULT now()

);

--projects
CREATE TABLE projects (

id SERIAL PRIMARY KEY,

name VARCHAR(255) NOT NULL,

description TEXT,

owner_id INT REFERENCES users(id),

status project_status DEFAULT 'ACTIVE',

created_at TIMESTAMP DEFAULT now(),

updated_at TIMESTAMP DEFAULT now()

);

--Project members
CREATE TABLE project_members (

id SERIAL PRIMARY KEY,

project_id INT REFERENCES projects(id) ON DELETE CASCADE,

user_id INT REFERENCES users(id) ON DELETE CASCADE,

role VARCHAR(50),

joined_at TIMESTAMP DEFAULT now(),

UNIQUE(project_id, user_id)

);

--Task
CREATE TABLE tasks (

id SERIAL PRIMARY KEY,

title VARCHAR(255) NOT NULL,

description TEXT,

project_id INT REFERENCES projects(id) ON DELETE CASCADE,

creator_id INT REFERENCES users(id),

assignee_id INT REFERENCES users(id),

status task_status DEFAULT 'TODO',

priority task_priority DEFAULT 'MEDIUM',

deadline TIMESTAMP,

created_at TIMESTAMP DEFAULT now(),

updated_at TIMESTAMP DEFAULT now()

);

--task comments
CREATE TABLE task_comments (

id SERIAL PRIMARY KEY,

task_id INT REFERENCES tasks(id) ON DELETE CASCADE,

user_id INT REFERENCES users(id),

content TEXT NOT NULL,

created_at TIMESTAMP DEFAULT now()

);

--tags
CREATE TABLE tags (

id SERIAL PRIMARY KEY,

name VARCHAR(100) UNIQUE NOT NULL,

created_at TIMESTAMP DEFAULT now()

);

--tasks-tag
CREATE TABLE task_tags (

id SERIAL PRIMARY KEY,

task_id INT REFERENCES tasks(id) ON DELETE CASCADE,

tag_id INT REFERENCES tags(id) ON DELETE CASCADE,

UNIQUE(task_id, tag_id)

);

--task attachments

CREATE TABLE task_attachments (

id SERIAL PRIMARY KEY,

task_id INT REFERENCES tasks(id) ON DELETE CASCADE,

file_url TEXT NOT NULL,

uploaded_by INT REFERENCES users(id),

created_at TIMESTAMP DEFAULT now()

);

--activity log
CREATE TABLE activity_logs (

id SERIAL PRIMARY KEY,

task_id INT REFERENCES tasks(id) ON DELETE CASCADE,

user_id INT REFERENCES users(id),

action VARCHAR(100),

old_value JSONB,

new_value JSONB,

created_at TIMESTAMP DEFAULT now()

);

--ai history
CREATE TABLE ai_histories (

id SERIAL PRIMARY KEY,

task_id INT REFERENCES tasks(id) ON DELETE CASCADE,

user_id INT REFERENCES users(id),

action_type ai_action_type,

prompt TEXT,

response TEXT,

created_at TIMESTAMP DEFAULT now()

);

--index
CREATE INDEX idx_tasks_project
ON tasks(project_id);

CREATE INDEX idx_tasks_assignee
ON tasks(assignee_id);

CREATE INDEX idx_tasks_status
ON tasks(status);

CREATE INDEX idx_comments_task
ON task_comments(task_id);

