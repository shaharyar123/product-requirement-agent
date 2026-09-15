WorkBoard — Product Requirements Document

Product-only PRD for the AI Factory | MVP | Version 1.0

# 1\. Product Overview

WorkBoard is a Trello-style task management platform for small and medium-sized teams. It allows users to create workspaces, organize projects on Kanban boards, assign tasks, collaborate through comments, and track progress.

## Problem Statement

Teams need a simple shared place to organize work, understand ownership, and track progress without the complexity of a large enterprise project management platform.

## Product Goal

Enable a team to move from a new workspace to an organized, actively managed project in a few minutes.

## Target Users

- Small software development teams
- Product and operations teams
- Team leads and project coordinators
- Individual contributors

# 2\. MVP Scope

The MVP includes:

- User registration, login, logout, and profile management
- Workspace creation and membership management
- Four user roles: Owner, Admin, Member, and Viewer
- Projects, Kanban boards, and customizable columns
- Task creation, editing, assignment, prioritization, and movement
- Comments and task activity history
- Dashboard with task counts and workload summaries
- Task search and filtering

Out of scope: real-time collaboration, email notifications, file uploads, recurring tasks, time tracking, billing, external integrations, mobile apps, and AI-powered task generation.

# 3\. Roles and Permissions

| Role   | Workspace Management                               | Project Management                | Task Management                                                 | Comments                       |
| ------ | -------------------------------------------------- | --------------------------------- | --------------------------------------------------------------- | ------------------------------ |
| Owner  | Full control; transfer ownership; delete workspace | Create, edit, archive, and delete | Full control                                                    | Create, edit, delete, moderate |
| Admin  | Manage members and roles                           | Create, edit, archive, and delete | Full control                                                    | Create, edit, delete, moderate |
| Member | View workspace membership                          | View accessible projects          | Create tasks; edit own or assigned tasks; move accessible tasks | Create; edit own comments      |
| Viewer | Read-only                                          | Read-only                         | Read-only                                                       | Read-only                      |

Rules: the workspace creator becomes Owner; every user must belong to a workspace before accessing its data; users cannot access another workspace's data; only the Owner can transfer ownership or delete a workspace.

# 4\. Functional Requirements

## Authentication and Profiles

- Users can register with name, email, and password.
- Users can log in and log out.
- Users can view and update their display name.
- Email addresses must be unique and invalid input must show a clear error.

## Workspaces and Members

- An authenticated user can create a workspace.
- The creator becomes the Owner.
- The system creates a default project and board for a new workspace.
- Owners and Admins can invite users and assign roles.
- Owners can change member roles, remove members, transfer ownership, and delete the workspace.
- Members can leave a workspace, except the Owner.

## Projects, Boards, and Columns

- Owners and Admins can create, rename, archive, and delete projects.
- A project can contain one or more boards.
- Boards contain ordered columns.
- Users with access can view projects and boards.
- Columns can be created, renamed, reordered, and deleted when empty.
- A board must always contain at least one column.

## Tasks

- Users can create tasks with title, description, priority, status, assignee, and due date.
- Every task belongs to one board and one column.
- Tasks can be moved between columns and reordered.
- Owners and Admins can edit and delete any task.
- Members can edit tasks they created or are assigned to.
- Users can filter tasks by assignee, priority, status, and due date.
- Each task has a human-readable unique key such as WB-001.
- Deleting a task requires confirmation.

## Comments and Activity

- Members can comment on accessible tasks.
- Comment authors can edit or delete their own comments.
- Owners and Admins can moderate comments.
- The system records task creation, assignment, status changes, and deletion in an activity history.
- Activity history is read-only and shown newest first.

## Dashboard and Search

- The dashboard shows task counts by status.
- Users can view tasks assigned to them.
- Owners and Admins can see workspace-level summaries.
- Users can search tasks by title and task key.
- Search and filters must never show unauthorized tasks.

# 5\. User Stories and Acceptance Criteria

## Register and sign in

As a new user, I want to create an account and sign in.

- Valid registration creates an account and signs the user in.
- An existing email cannot create a duplicate account.
- Valid credentials allow login.
- Invalid credentials show a generic error.

## Create a workspace

As an authenticated user, I want to create a workspace for my team.

- Creating a valid workspace makes the creator its Owner.
- A default project, board, and starter columns are created.
- Invalid workspace names are rejected.

## Invite a member

As an Owner or Admin, I want to invite teammates with appropriate permissions.

- An invited user is added with the selected role.
- Duplicate membership is rejected.
- Members cannot invite users or change roles.

## Manage tasks

As a Member, I want to create and organize tasks on a board.

- A valid task appears in the selected column.
- Tasks can be moved and reordered.
- Viewers cannot create or edit tasks.
- Unauthorized users cannot access tasks.

## Collaborate

As a Member, I want to discuss a task with comments.

- Accessible tasks accept non-empty comments.
- Authors can edit their own comments.
- Users cannot edit another user's comments unless they are authorized moderators.

## View progress

As a team member, I want to understand current workload.

- Dashboard counts reflect accessible tasks.
- Search and filters return only matching authorized tasks.
- Empty results show a useful empty state.

# 6\. Core Workflows

## Workspace Onboarding

1. User registers or logs in.
2. User creates a workspace.
3. The system creates a default project and board.
4. The Owner invites teammates and assigns roles.
5. The team opens the board and creates tasks.

## Task Lifecycle

1. User opens a board.
2. User creates a task.
3. User adds details, priority, due date, and assignee.
4. Task starts in To Do.
5. User moves it to In Progress.
6. User completes it in Done.
7. The system records relevant activity.

## Permission Check

1. User requests an action.
2. The system verifies authentication.
3. The system verifies workspace membership.
4. The system verifies role and resource access.
5. The action is allowed or rejected with a clear error.

# 7\. UI and Experience Requirements

- Provide screens for login, registration, workspace selection, workspace creation, members, projects, board, task details, dashboard, and profile.
- The Kanban board must support drag-and-drop and an accessible non-drag alternative.
- Forms must show validation, loading, success, and error states.
- The interface must work on desktop and mobile widths.
- Task details should include description, priority, assignee, due date, comments, and activity.
- Use clear empty states when there are no projects, tasks, comments, or search results.
- Protected screens must redirect unauthenticated users to login.

# 8\. Business Rules

- A user may belong to multiple workspaces.
- A user has one role per workspace.
- A task can have zero or one assignee.
- An assignee must be a member of the task's workspace.
- A task cannot be placed in a column from another board or workspace.
- A column cannot be deleted if it contains tasks.
- A board must retain at least one column.
- Only the Owner can transfer ownership or delete the workspace.
- Deleting a project deletes or archives its boards and tasks according to the final product decision; the factory must ask for clarification if this behavior is not confirmed.
- All dates shown to users should respect the user's local timezone, while stored timestamps should remain consistent.

# 9\. Non-Functional Product Expectations

- The product should feel simple and responsive for small teams.
- Common actions should provide immediate visible feedback.
- The system should prevent accidental destructive actions through confirmation.
- The product must provide understandable errors rather than technical stack traces.
- The product must protect private workspace data.
- The generated application must be usable with keyboard navigation and accessible labels.

# 10\. Seed Data and Demo Experience

- Create a demo workspace named WorkBoard Demo.
- Create one Owner, one Admin, one Member, and one Viewer.
- Create a Website Redesign project with a Sprint Board.
- Create To Do, In Progress, and Done columns.
- Create at least three realistic tasks with different priorities and statuses.
- Create sample comments and activity history.
- Provide demo credentials in development documentation only.
- Seed data must be deterministic and safe to rerun in development.

# 11\. Definition of Done

- All MVP features are implemented according to this PRD.
- All user stories have passing acceptance tests.
- Every role is tested against allowed and forbidden actions.
- The product can be started locally using documented commands.
- A new workspace can be created and used without manual database editing.
- The application includes realistic seed data.
- The factory reports generated files, test results, known limitations, and unresolved decisions.

# 12\. AI Factory Clarification Questions

Before generating architecture or code, the AI Factory should ask questions where the PRD is ambiguous, including:

- Should a Member be allowed to edit any task in an accessible project, or only tasks they created or are assigned to?
- Should deleting a project permanently delete its tasks or archive them?
- Should invitations require email delivery, or can an Owner add an existing user directly in the MVP?
- Should viewers see comments and activity, or only task fields?
- Should users be able to create custom columns beyond the default columns?
- Should a task have one assignee or multiple assignees?
- What is the preferred visual style and branding?
- What exact technical stack and deployment target should be used?

# 13\. Separate Factory Configuration

The following should be supplied as configuration alongside this PRD rather than embedded in product requirements:

- Frontend: React + TypeScript
- Backend: NestJS + TypeScript
- Database: PostgreSQL
- Repository: monorepo
- Local development: Docker Compose
- Required output: runnable project, migrations, seed data, tests, documentation, and validation report

End of PRD