# Database Tool Examples

This document provides examples of how to use the database tools to store and retrieve data in your agent applications.

## Basic Data Storage and Retrieval

### Storing Data

```javascript
// Store a simple string value
const result = await DB_storeData({
  key: "greeting",
  data: "Hello, world!",
  metadata1: "example"
});

// Store JSON data (will be automatically stringified)
const userResult = await DB_storeData({
  key: "user_preferences",
  data: JSON.stringify({
    theme: "dark",
    fontSize: 14,
    notifications: true
  }),
  metadata1: "settings"
});
```

### Retrieving Data

```javascript
// Retrieve the stored data
const greeting = await DB_getData({
  key: "greeting"
});
console.log(greeting.data); // "Hello, world!"

// Retrieve JSON data (will be automatically parsed)
const preferences = await DB_getData({
  key: "user_preferences"
});
console.log(preferences.data.theme); // "dark"
```

### Querying Multiple Records

```javascript
// Query all data with metadata1="settings"
const allSettings = await DB_queryData({
  metadata1: "settings",
  limit: 10
});

// Process the results
allSettings.results.forEach(item => {
  console.log(`${item.key}: ${JSON.stringify(item.data)}`);
});
```

## Virtual Tables for Structured Data

### Creating a Table Schema

```javascript
// Define a contact table schema
const contactTableResult = await DB_createTable({
  tableName: "contacts",
  schema: [
    {
      name: "name",
      type: "string",
      required: true
    },
    {
      name: "email",
      type: "string",
      required: true
    },
    {
      name: "phone",
      type: "string",
      required: false
    },
    {
      name: "notes",
      type: "string",
      required: false
    },
    {
      name: "lastContacted",
      type: "date",
      required: false
    }
  ]
});
```

### Inserting Rows

```javascript
// Insert a row into the contacts table
const insertResult = await DB_insertRow({
  tableName: "contacts",
  data: {
    name: "John Doe",
    email: "john@example.com",
    phone: "555-1234",
    notes: "Met at conference",
    lastContacted: new Date()
  }
});
```

### Querying a Table

```javascript
// Query all rows from the contacts table
const contacts = await DB_queryTable({
  tableName: "contacts",
  limit: 20
});

// Process the results
contacts.rows.forEach(row => {
  console.log(`Name: ${row.data.name}, Email: ${row.data.email}`);
});
```

## Using Namespaces for Organization

You can use namespaces to organize your data into logical groups:

```javascript
// Store data in a custom namespace
const projectResult = await DB_storeData({
  key: "project123",
  data: JSON.stringify({
    name: "Secret Project",
    deadline: "2023-12-31",
    status: "in-progress"
  }),
  namespace: "projects"
});

// Query all data in a namespace
const allProjects = await DB_queryData({
  namespace: "projects"
});
```

## Usage in Agent Workflows

The database tools are particularly useful for:

1. **Maintaining State**: Store and retrieve state information across multiple interactions
2. **Caching Results**: Save expensive computation or API results for later use
3. **User Preferences**: Store user preferences and settings
4. **Collecting and Processing Data**: Gather data over time and process it in batches
5. **Creating Simple Applications**: Build simple database-backed applications

Each agent has its own dedicated namespace, providing isolation between different agents' data. 