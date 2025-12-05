// Intex - Ella Rises
// Group 3 - 14
// Ella Rises Website for users and managers to track data.

// Import libraries
require('dotenv').config();
const express = require("express");
const session = require("express-session");
let path = require("path");
let bodyParser = require("body-parser");
let app = express();

// Set view engine
app.set("view engine", "ejs");
// Set routes for images and styles
app.use("/styles", express.static(path.join(__dirname, "styles")));
app.use("/images", express.static(path.join(__dirname, "images")));
// Use port
const port = process.env.PORT || 3000;


// Session secret key
app.use(
    session(
        {
    secret: process.env.SESSION_SECRET || 'fallback-secret-key',
    resave: false,
    saveUninitialized: false,
        }
    )
);

// Connect to the database
const knex = require("knex")({
    client: "pg",
    connection: {
        host: process.env.RDS_HOSTNAME || "localhost",
        user: process.env.RDS_USERNAME || "postgres",
        password: process.env.RDS_PASSWORD || "IntexGroup314",
        database: process.env.RDS_DB_NAME || "intex",
        port: process.env.RDS_PORT || 5432,
        // The new part 
        ssl: process.env.DB_SSL ? {rejectUnauthorized: false} : false 
    }
});

app.use(express.urlencoded({extended: true}));

// Home page route - Pass session data to template
app.get('/', (req, res) => {
    res.render('index', {
        username: req.session.username || null,
        level: req.session.level || null
    });
});

// About page route
app.get('/about', (req, res) => {
    res.render('about', {
        username: req.session.username || null,
        level: req.session.level || null
    });
});

// Dashboard route
app.get('/dashboard', (req, res) => {
    res.render('dashboard', {
        username: req.session.username || null,
        level: req.session.level || null
    });
});

// Email page route
app.get('/email', (req, res) => {
    res.render('email', {
        username: req.session.username || null,
        level: req.session.level || null
    });
});

// Login GET route - Display login page
app.get('/login', (req, res) => {
    // Check if user is already logged in
    if (req.session.username) {
        return res.redirect('/');
    }
    // Render the login page
    res.render('login', {
        error: null,
        message: null,
        username: null,
        level: null
    });
});

// Login POST route - Handle login submission
app.post('/login', async (req, res) => {
    const { username, password } = req.body;
    
    try {
        // Validate input
        if (!username || !password) {
            return res.render('login', {
                error: 'Please provide both username and password',
                message: null,
                username: null,
                level: null
            });
        }
        
        // Query database for user
        const user = await knex('users')
            .where({ username: username })
            .first();
        
        // Check if user exists
        if (!user) {
            return res.render('login', {
                error: 'Invalid username or password',
                message: null,
                username: null,
                level: null
            });
        }
        
        // Check if password matches
        if (user.password !== password) {
            return res.render('login', {
                error: 'Invalid username or password',
                message: null,
                username: null,
                level: null
            });
        }
        
        // Store user information in session
        req.session.username = user.username;
        req.session.level = user.level;
        
        // Redirect to home page or dashboard
        res.redirect('/');
        
    } catch (error) {
        console.error('Login error:', error);
        res.render('login', {
            error: 'An error occurred during login. Please try again.',
            message: null,
            username: null,
            level: null
        });
    }
});

// Logout route
app.get('/logout', (req, res) => {
    req.session.destroy((err) => {
        if (err) {
            console.error('Logout error:', err);
            return res.redirect('/');
        }
        // Redirect back to login page
        res.redirect('/login');
    });
});

// Middleware to check if user is authenticated
function isAuthenticated(req, res, next) {
    if (req.session.username) {
        return next();
    }
    res.redirect('/login');
}

// Example of protecting a route
// app.get('/participants', isAuthenticated, (req, res) => {
//     res.render('participants', {
//         username: req.session.username,
//         level: req.session.level
//     });
// });

// ============== USERS ROUTES ==============

// Display users page
app.get('/users', isAuthenticated, async (req, res) => {
    try {
        const page = parseInt(req.query.page) || 1;
        const limit = 10;
        const offset = (page - 1) * limit;
        const search = req.query.search || '';

        // Build query
        let query = knex('users');
        
        if (search) {
            query = query.where('username', 'like', `%${search}%`);
        }

        // Get total count
        const countResult = await query.clone().count('* as count');
        const totalRecords = countResult[0].count;
        const totalPages = Math.ceil(totalRecords / limit);

        // Get paginated results
        const users = await query
            .select('*')
            .limit(limit)
            .offset(offset)
            .orderBy('userid');

        res.render('users', {
            username: req.session.username,
            level: req.session.level,
            users,
            currentPage: page,
            totalPages,
            totalRecords,
            search,
            message: req.query.message || null,
            error: req.query.error || null
        });
    } catch (error) {
        console.error('Users page error:', error);
        res.render('users', {
            username: req.session.username,
            level: req.session.level,
            users: [],
            currentPage: 1,
            totalPages: 1,
            totalRecords: 0,
            search: '',
            message: null,
            error: 'Error loading users'
        });
    }
});

// Delete user
app.post('/users/delete/:userid', isAuthenticated, async (req, res) => {
    if (req.session.level !== 'M') {
        return res.redirect('/users?error=Unauthorized');
    }

    try {
        await knex('users')
            .where({ userid: req.params.userid })
            .delete();
        
        res.redirect('/users?message=User deleted successfully');
    } catch (error) {
        console.error('Delete user error:', error);
        res.redirect('/users?error=Error deleting user');
    }
});

// ============== PARTICIPANTS ROUTES ==============

// Display participants page
app.get('/participants', isAuthenticated, async (req, res) => {
    try {
        const page = parseInt(req.query.page) || 1;
        const limit = 10;
        const offset = (page - 1) * limit;
        const search = req.query.search || '';

        // Build query
        let query = knex('participant');
        
        if (search) {
            query = query.where(function() {
                this.where('participantemail', 'like', `%${search}%`)
                    .orWhere('participantfirstname', 'like', `%${search}%`)
                    .orWhere('participantlastname', 'like', `%${search}%`);
            });
        }

        // Get total count
        const countResult = await query.clone().count('* as count');
        const totalRecords = countResult[0].count;
        const totalPages = Math.ceil(totalRecords / limit);

        // Get paginated results
        const participants = await query
            .select('*')
            .limit(limit)
            .offset(offset)
            .orderBy('participantid');

        res.render('participants', {
            username: req.session.username,
            level: req.session.level,
            participants,
            currentPage: page,
            totalPages,
            totalRecords,
            search,
            message: req.query.message || null,
            error: req.query.error || null
        });
    } catch (error) {
        console.error('Participants page error:', error);
        res.render('participants', {
            username: req.session.username,
            level: req.session.level,
            participants: [],
            currentPage: 1,
            totalPages: 1,
            totalRecords: 0,
            search: '',
            message: null,
            error: 'Error loading participants'
        });
    }
});

// Delete participant
app.post('/participants/delete/:id', isAuthenticated, async (req, res) => {
    if (req.session.level !== 'M') {
        return res.redirect('/participants?error=Unauthorized');
    }

    try {
        await knex('participant')
            .where({ participantid: req.params.id })
            .delete();
        
        res.redirect('/participants?message=Participant deleted successfully');
    } catch (error) {
        console.error('Delete participant error:', error);
        res.redirect('/participants?error=Error deleting participant');
    }
});

// ============== EVENTS ROUTES ==============

// Display events page
app.get('/events', isAuthenticated, async (req, res) => {
    try {
        const page = parseInt(req.query.page) || 1;
        const limit = 10;
        const offset = (page - 1) * limit;
        const search = req.query.search || '';

        // Build query
        let query = knex('event');
        
        if (search) {
            query = query.where(function() {
                this.where('eventname', 'like', `%${search}%`)
                    .orWhere('eventtype', 'like', `%${search}%`);
            });
        }

        // Get total count
        const countResult = await query.clone().count('* as count');
        const totalRecords = countResult[0].count;
        const totalPages = Math.ceil(totalRecords / limit);

        // Get paginated results
        const events = await query
            .select('*')
            .limit(limit)
            .offset(offset)
            .orderBy('eventname');

        res.render('events', {
            username: req.session.username,
            level: req.session.level,
            events,
            currentPage: page,
            totalPages,
            totalRecords,
            search,
            message: req.query.message || null,
            error: req.query.error || null
        });
    } catch (error) {
        console.error('Events page error:', error);
        res.render('events', {
            username: req.session.username,
            level: req.session.level,
            events: [],
            currentPage: 1,
            totalPages: 1,
            totalRecords: 0,
            search: '',
            message: null,
            error: 'Error loading events'
        });
    }
});

// Delete event
app.post('/events/delete/:id', isAuthenticated, async (req, res) => {
    if (req.session.level !== 'M') {
        return res.redirect('/events?error=Unauthorized');
    }

    try {
        await knex('event')
            .where({ eventname: req.params.id })
            .delete();
        
        res.redirect('/events?message=Event deleted successfully');
    } catch (error) {
        console.error('Delete event error:', error);
        res.redirect('/events?error=Error deleting event');
    }
});

// ============== SURVEYS ROUTES ==============

// Display surveys page
app.get('/surveys', isAuthenticated, async (req, res) => {
    try {
        const page = parseInt(req.query.page) || 1;
        const limit = 10;
        const offset = (page - 1) * limit;
        const search = req.query.search || '';

        // Build base query with joins
        let baseQuery = knex('survey')
            .join('registration', 'survey.registrationid', 'registration.registrationid')
            .join('participant', 'registration.participantid', 'participant.participantid')
            .join('eventoccurrence', 'registration.eventoccurrenceid', 'eventoccurrence.eventoccurrenceid')
            .join('event', 'eventoccurrence.eventid', 'event.eventid');
        
        if (search) {
            baseQuery = baseQuery.where('event.eventname', 'like', `%${search}%`);
        }

        // Get total count (separate query, no GROUP BY issue)
        const countResult = await baseQuery.clone().count('survey.surveyid as count');
        const totalRecords = countResult[0].count;
        const totalPages = Math.ceil(totalRecords / limit);

        // Get paginated results
        const surveys = await baseQuery.clone()
            .select(
                'survey.surveyid',
                'event.eventname',
                'participant.participantfirstname',
                'survey.surveyusefulnessscore',
                'survey.surveyrecommendationscore',
                'survey.surveyoverallscore',
                'survey.surveysubmissiondate'
            )
            .limit(limit)
            .offset(offset)
            .orderBy('survey.surveysubmissiondate', 'desc');

        res.render('surveys', {
            username: req.session.username,
            level: req.session.level,
            surveys,
            currentPage: page,
            totalPages,
            totalRecords,
            search,
            message: req.query.message || null,
            error: req.query.error || null
        });
    } catch (error) {
        console.error('Surveys page error:', error);
        res.render('surveys', {
            username: req.session.username,
            level: req.session.level,
            surveys: [],
            currentPage: 1,
            totalPages: 1,
            totalRecords: 0,
            search: '',
            message: null,
            error: 'Error loading surveys'
        });
    }
});

// Delete survey
app.post('/surveys/delete/:id', isAuthenticated, async (req, res) => {
    if (req.session.level !== 'M') {
        return res.redirect('/surveys?error=Unauthorized');
    }

    try {
        await knex('survey')
            .where({ surveyid: req.params.id })
            .delete();
        
        res.redirect('/surveys?message=Survey deleted successfully');
    } catch (error) {
        console.error('Delete survey error:', error);
        res.redirect('/surveys?error=Error deleting survey');
    }
});

// ============== MILESTONES ROUTES ==============

// Display milestones page
app.get('/milestones', isAuthenticated, async (req, res) => {
    try {
        const page = parseInt(req.query.page) || 1;
        const limit = 10;
        const offset = (page - 1) * limit;
        const search = req.query.search || '';

        // Build base query
        let baseQuery = knex('milestone')
            .join('participant', 'milestone.participantid', 'participant.participantid');
        
        if (search) {
            baseQuery = baseQuery.where(function() {
                this.where('participant.participantfirstname', 'like', `%${search}%`)
                    .orWhere('participant.participantlastname', 'like', `%${search}%`)
                    .orWhere('milestone.milestonetitle', 'like', `%${search}%`);
            });
        }

        // Get total count (separate query, no GROUP BY issue)
        const countResult = await baseQuery.clone().count('milestone.milestoneid as count');
        const totalRecords = countResult[0].count;
        const totalPages = Math.ceil(totalRecords / limit);

        // Get paginated results
        const milestones = await baseQuery.clone()
            .select(
                'milestone.milestoneid',
                'participant.participantfirstname',
                'participant.participantlastname',
                'milestone.milestonetitle',
                'milestone.milestonedate'
            )
            .limit(limit)
            .offset(offset)
            .orderBy('milestone.milestonedate', 'desc');

        res.render('milestones', {
            username: req.session.username,
            level: req.session.level,
            milestones,
            currentPage: page,
            totalPages,
            totalRecords,
            search,
            message: req.query.message || null,
            error: req.query.error || null
        });
    } catch (error) {
        console.error('Milestones page error:', error);
        res.render('milestones', {
            username: req.session.username,
            level: req.session.level,
            milestones: [],
            currentPage: 1,
            totalPages: 1,
            totalRecords: 0,
            search: '',
            message: null,
            error: 'Error loading milestones'
        });
    }
});

// Delete milestone
app.post('/milestones/delete/:id', isAuthenticated, async (req, res) => {
    if (req.session.level !== 'M') {
        return res.redirect('/milestones?error=Unauthorized');
    }

    try {
        await knex('milestone')
            .where({ milestoneid: req.params.id })
            .delete();
        
        res.redirect('/milestones?message=Milestone deleted successfully');
    } catch (error) {
        console.error('Delete milestone error:', error);
        res.redirect('/milestones?error=Error deleting milestone');
    }
});

// ============== DONATIONS ROUTES ==============

// Display donations page
app.get('/donations', isAuthenticated, async (req, res) => {
    try {
        const page = parseInt(req.query.page) || 1;
        const limit = 10;
        const offset = (page - 1) * limit;
        const search = req.query.search || '';

        // Build base query with join
        let baseQuery = knex('donation')
            .join('participant', 'donation.participantid', 'participant.participantid');
        
        if (search) {
            baseQuery = baseQuery.where(function() {
                this.where('participant.participantfirstname', 'like', `%${search}%`)
                    .orWhere('participant.participantlastname', 'like', `%${search}%`);
            });
            //baseQuery = baseQuery.where('participant.participantfirstname', 'like', `%${search}%`);
        }

        // Get total count (separate query, no GROUP BY issue)
        const countResult = await baseQuery.clone().count('donation.donationid as count');
        const totalRecords = countResult[0].count;
        const totalPages = Math.ceil(totalRecords / limit);

        // Get paginated results
        const donations = await baseQuery.clone()
            .select(
                'donation.donationid',
                'participant.participantfirstname',
                'participant.participantlastname',
                'donation.donationdate',
                'donation.donationamount'
            )
            .limit(limit)
            .offset(offset)
            .orderBy('donation.donationdate', 'desc');

        res.render('donations', {
            username: req.session.username,
            level: req.session.level,
            donations,
            currentPage: page,
            totalPages,
            totalRecords,
            search,
            message: req.query.message || null,
            error: req.query.error || null
        });
    } catch (error) {
        console.error('Donations page error:', error);
        res.render('donations', {
            username: req.session.username,
            level: req.session.level,
            donations: [],
            currentPage: 1,
            totalPages: 1,
            totalRecords: 0,
            search: '',
            message: null,
            error: 'Error loading donations'
        });
    }
});

// Delete donation
app.post('/donations/delete/:id', isAuthenticated, async (req, res) => {
    if (req.session.level !== 'M') {
        return res.redirect('/donations?error=Unauthorized');
    }

    try {
        await knex('donation')
            .where({ donationid: req.params.id })
            .delete();
        
        res.redirect('/donations?message=Donation deleted successfully');
    } catch (error) {
        console.error('Delete donation error:', error);
        res.redirect('/donations?error=Error deleting donation');
    }
});

// Long function to format the titles in the edit and add forms
app.locals.formatName = function(name) {
    return name
        .replace(/participant/, "Participant ")
        .replace(/event/, "Event ")
        .replace(/survey/, "Survey ")
        .replace(/donations/, "Donations")
        .replace(/donation/, "Donation ")
        .replace(/registration/, "Registration ")
        .replace(/milestone/, "Milestone ")
        .replace(/total/, "Total ")
        .replace(/id/, "ID")
        .replace(/email/, "Email")
        .replace(/firstname/, "First Name")
        .replace(/lastname/, "Last Name")
        .replace(/dob/, "Date Of Birth")
        .replace(/role/, "Role")
        .replace(/phone/, "Phone")
        .replace(/city/, "City")
        .replace(/state/, "State")
        .replace(/zip/, "ZIP Code")
        .replace(/schooloremployer/, "School Or Employer")
        .replace(/fieldofinterest/, "Field Of Interest")
        .replace(/name/, "Name")
        .replace(/type/, "Type")
        .replace(/description/, "Description")
        .replace(/recurrencepattern/, "Recurrence Pattern")
        .replace(/defaultcapacity/, "Default Capacity")
        .replace(/sastisfaction/, "Satisfaction")
        .replace(/usefulness/, "Usefulness")
        .replace(/instructor/, "Instructor")
        .replace(/recommendation/, "Recommendation")
        .replace(/overall/, "Overall")
        .replace(/score/, " Score")
        .replace(/npsbucket/, "NPS Bucket")
        .replace(/comments/, "Comments")
        .replace(/submissiondate/, "Submission Date")
        .replace(/title/, "Title")
        .replace(/date/, "Date")
        .replace(/number/, "Number")
        .replace(/amount/, "Amount")
        .replace(/userName/, "Username")
        .replace(/password/, "Password")
        .replace(/level/, "Level")
        .trim();
};

// ============== HELPER FUNCTION TO GET TABLE SCHEMA ==============

async function getTableSchema(tableName, primaryKeyColumn = null) {
    try {
        // Get column information from database
        const columns = await knex(tableName).columnInfo();
        
        // Transform column info into usable format
        const columnArray = Object.keys(columns).map(columnName => {
            const col = columns[columnName];
            
            return {
                name: columnName,
                dataType: col.type,
                maxLength: col.maxLength,
                isRequired: col.nullable === false,
                isPrimary: false, // Will be set separately
                isAutoIncrement: false, // Will be set separately
                hint: null // Can be customized per field
            };
        });
        
        // If primary key is explicitly provided, use it
        if (primaryKeyColumn) {
            const primaryCol = columnArray.find(col => col.name === primaryKeyColumn);
            if (primaryCol) {
                primaryCol.isPrimary = true;
                primaryCol.isAutoIncrement = true;
            }
        } else {
            // Try to identify primary key (common patterns)
            const primaryKeyPatterns = ['id', 'ID'];
            
            // First, try exact matches
            let foundPrimary = false;
            for (const col of columnArray) {
                if (primaryKeyPatterns.some(pattern => col.name.toLowerCase() === pattern)) {
                    col.isPrimary = true;
                    col.isAutoIncrement = true;
                    foundPrimary = true;
                    break;
                }
            }
            
            // If not found, try pattern matching with table name
            if (!foundPrimary) {
                const tableNameLower = tableName.toLowerCase();
                for (const col of columnArray) {
                    const colNameLower = col.name.toLowerCase();
                    if (colNameLower === `${tableNameLower}id` || 
                        colNameLower.endsWith('id') && colNameLower.includes(tableNameLower)) {
                        col.isPrimary = true;
                        col.isAutoIncrement = true;
                        foundPrimary = true;
                        break;
                    }
                }
            }
            
            // If still not found, use the first column that contains 'id'
            if (!foundPrimary) {
                for (const col of columnArray) {
                    if (col.name.toLowerCase().includes('id')) {
                        col.isPrimary = true;
                        col.isAutoIncrement = true;
                        break;
                    }
                }
            }
        }
        
        return columnArray;
    } catch (error) {
        console.error('Error getting table schema:', error);
        throw error;
    }
}

// ============== MAPPING OF TABLES TO PRIMARY KEYS ==============
const tablePrimaryKeys = {
    'users': 'userid',
    'participant': 'participantid',
    'event': 'eventid',
    'survey': 'surveyid',
    'milestone': 'milestoneid',
    'donation': 'donationid',
    'registration': 'registrationid',
    'eventoccurrence': 'eventoccurrenceid'
    // Add more table mappings as needed
};

// ============== GENERIC ADD ROUTES ==============

// Display add form
app.get('/:table/add', isAuthenticated, async (req, res) => {
    if (req.session.level !== 'M') {
        return res.redirect(`/${req.params.table}?error=Unauthorized`);
    }

    try {
        const tableName = req.params.table;
        const primaryKey = tablePrimaryKeys[tableName] || null;
        const columns = await getTableSchema(tableName, primaryKey);
        
        res.render('add', {
            username: req.session.username,
            level: req.session.level,
            tableName: tableName,
            returnPath: tableName,
            columns,
            error: null
        });
    } catch (error) {
        console.error('Add form error:', error);
        res.redirect(`/${req.params.table}?error=Error loading add form`);
    }
});

// Handle add form submission
app.post('/:table/add', isAuthenticated, async (req, res) => {
    if (req.session.level !== 'M') {
        return res.redirect(`/${(req.params.table === 'users' ? req.params.table : req.params.table + 's')}?error=Unauthorized`);
    }

    try {
        const tableName = req.params.table;
        const data = {};
        
        // Process form data
        for (const [key, value] of Object.entries(req.body)) {
            // Handle checkboxes (boolean values)
            if (value === 'true') {
                data[key] = true;
            } else if (value === '' || value === null) {
                data[key] = null;
            } else {
                data[key] = value;
            }
        }
        
        // Insert into database
        await knex(tableName).insert(data);
        
        res.redirect(`/${(tableName === 'users' ? tableName : tableName + 's')}?message=Record added successfully`);
    } catch (error) {
        console.error('Add record error:', error);
        res.redirect(`/${req.params.table}/add?error=Error adding record: ${error.message}`);
    }
});

// ============== GENERIC EDIT ROUTES ==============

// Display edit form
app.get('/:table/edit/:id', isAuthenticated, async (req, res) => {
    if (req.session.level !== 'M') {
        return res.redirect(`/${(req.params.table === 'users' ? req.params.table : req.params.table + 's')}?error=Unauthorized`);
    }

    try {
        const tableName = req.params.table;
        const recordId = req.params.id;
        const primaryKey = tablePrimaryKeys[tableName] || null;
        const columns = await getTableSchema(tableName, primaryKey);
        
        // Find the primary key column
        const primaryKeyCol = columns.find(col => col.isPrimary);
        if (!primaryKeyCol) {
            throw new Error(`No primary key found for table ${tableName}. Please add it to tablePrimaryKeys mapping.`);
        }
        
        // Get the record
        const record = await knex(tableName)
            .where(primaryKeyCol.name, recordId)
            .first();
        
        if (!record) {
            return res.redirect(`/${(tableName === 'users' ? tableName : tableName + 's')}?error=Record not found`);
        }
        
        res.render('edit', {
            username: req.session.username,
            level: req.session.level,
            tableName: tableName.charAt(0).toUpperCase() + tableName.slice(1),
            returnPath: tableName,
            columns,
            record,
            recordId,
            error: null
        });
    } catch (error) {
        console.error('Edit form error:', error);
        res.redirect(`/${(req.params.table === 'users' ? req.params.table : req.params.table + 's')}?error=Error loading edit form: ${error.message}`);
    }
});

// Handle edit form submission
app.post('/:table/edit/:id', isAuthenticated, async (req, res) => {
    if (req.session.level !== 'M') {
        return res.redirect(`/${(req.params.table === 'users' ? req.params.table : req.params.table + 's')}?error=Unauthorized`);
    }

    try {
        const tableName = req.params.table;
        const recordId = req.params.id;
        const primaryKey = tablePrimaryKeys[tableName] || null;
        const columns = await getTableSchema(tableName, primaryKey);
        
        // Find the primary key column
        const primaryKeyCol = columns.find(col => col.isPrimary);
        if (!primaryKeyCol) {
            throw new Error(`No primary key found for table ${tableName}. Please add it to tablePrimaryKeys mapping.`);
        }
        
        const data = {};
        
        // Process form data
        for (const [key, value] of Object.entries(req.body)) {
            // Skip primary key
            if (key === primaryKeyCol.name) continue;
            
            // Handle checkboxes (boolean values)
            if (value === 'true') {
                data[key] = true;
            } else if (value === '' || value === null) {
                data[key] = null;
            } else {
                data[key] = value;
            }
        }
        
        // Handle unchecked checkboxes (they don't send a value)
        columns.forEach(col => {
            if ((col.dataType === 'boolean' || col.dataType === 'bit') && 
                !col.isPrimary && 
                !(col.name in req.body)) {
                data[col.name] = false;
            }
        });
        
        // Update in database
        await knex(tableName)
            .where(primaryKeyCol.name, recordId)
            .update(data);
        
        res.redirect(`/${(tableName === 'users' ? tableName : tableName + 's')}?message=Record updated successfully`);
    } catch (error) {
        console.error('Update record error:', error);
        res.redirect(`/${req.params.table}/edit/${req.params.id}?error=Error updating record: ${error.message}`);
    }
});

// ============== SPECIFIC TABLE ROUTES (for custom schemas) ==============

// Example: Custom schema for users table
app.get('/users/add', isAuthenticated, async (req, res) => {
    if (req.session.level !== 'M') {
        return res.redirect('/users?error=Unauthorized');
    }

    const columns = [
        { name: 'userid', dataType: 'integer', isRequired: true, isPrimary: true, isAutoIncrement: true },
        { name: 'username', dataType: 'character varying', maxLength: 100, isRequired: true },
        { name: 'password', dataType: 'character varying', maxLength: 255, isRequired: true, hint: 'Enter a secure password' },
        { name: 'level', dataType: 'character varying', maxLength: 1, isRequired: true, hint: 'M for Manager, U for User' }
    ];
    
    res.render('add', {
        username: req.session.username,
        level: req.session.level,
        tableName: 'User',
        returnPath: 'users',
        columns,
        error: null
    });
});

app.post('/users/add', isAuthenticated, async (req, res) => {
    if (req.session.level !== 'M') {
        return res.redirect('/users?error=Unauthorized');
    }

    try {
        const { username, password, level } = req.body;
        
        // Optional: Hash password here with bcrypt
        // const hashedPassword = await bcrypt.hash(password, 10);
        
        await knex('users').insert({
            username,
            password, // Use hashedPassword if hashing
            level
        });
        
        res.redirect('/users?message=User added successfully');
    } catch (error) {
        console.error('Add user error:', error);
        res.redirect('/users/add?error=Error adding user');
    }
});

// Example: Custom edit for users
app.get('/users/edit/:id', isAuthenticated, async (req, res) => {
    if (req.session.level !== 'M') {
        return res.redirect('/users?error=Unauthorized');
    }

    try {
        const user = await knex('users')
            .where('userid', req.params.id)
            .first();
        
        if (!user) {
            return res.redirect('/users?error=User not found');
        }
        
        const columns = [
            { name: 'userid', dataType: 'integer', isRequired: true, isPrimary: true, isAutoIncrement: true },
            { name: 'username', dataType: 'character varying', maxLength: 100, isRequired: true },
            { name: 'password', dataType: 'character varying', maxLength: 255, isRequired: false, hint: 'Leave blank to keep current password' },
            { name: 'level', dataType: 'character varying', maxLength: 1, isRequired: true, hint: 'M for Manager, U for User' }
        ];
        
        res.render('edit', {
            username: req.session.username,
            level: req.session.level,
            tableName: 'User',
            returnPath: 'users',
            columns,
            record: user,
            recordId: req.params.id,
            error: null
        });
    } catch (error) {
        console.error('Edit user error:', error);
        res.redirect('/users?error=Error loading user');
    }
});

app.post('/users/edit/:id', isAuthenticated, async (req, res) => {
    if (req.session.level !== 'M') {
        return res.redirect('/users?error=Unauthorized');
    }

    try {
        const { username, password, level } = req.body;
        const updateData = { username, level };
        
        // Only update password if provided
        if (password && password.trim() !== '') {
            // Optional: Hash password here with bcrypt
            // updateData.password = await bcrypt.hash(password, 10);
            updateData.password = password;
        }
        
        await knex('users')
            .where('userid', req.params.id)
            .update(updateData);
        
        res.redirect('/users?message=User updated successfully');
    } catch (error) {
        console.error('Update user error:', error);
        res.redirect(`/users/edit/${req.params.id}?error=Error updating user`);
    }
});

// Route for event survey once user has entered email and chosen the event
app.get("/visitorSurvey/:pid/:eid", async (req, res) => {
    const eventDatesResult = await knex('eventoccurrence')
        .join('registration', 'eventoccurrence.eventoccurrenceid', 'registration.eventoccurrenceid')
        .where('registration.participantid', req.params.pid)
        .where('eventoccurrence.eventid', req.params.eid)
        .whereNotNull('eventoccurrence.eventdatetimestart')
        .distinct('eventoccurrence.eventdatetimestart')
        .orderBy('eventoccurrence.eventdatetimestart');

    const eventDates = eventDatesResult.map(row => {
        const dateObj = new Date(row.eventdatetimestart);
        return {
            value: dateObj.toISOString(), // for queries
            display: dateObj.toLocaleDateString() // human-readable for dropdown
        };
    });
    
    knex('event')
        .where('eventid', req.params.eid)
        .first()
        .then((event) => {
            res.render("visitorSurvey", {
            message: "",
            error_message: "",
            username: req.session.username || null,
            level: req.session.level || null,
            eventDates,
            event,
            pid : req.params.pid
            });
        })
        .catch((error) => {
            console.log(error);
            res.redirect("/email");
        });
});

// Post for event survey
app.post("/visitorSurvey", async (req, res) => {
    const { eventid, eventdatetimestart, participantid, surveysatisfactionscore, surveyusefulnessscore, surveyinstructorscore, surveyrecommendationscore, surveycomments, surveysubmissiondate } = req.body;
    // Calculate the overallscore
    const surveyoverallscore = (
        Math.round(
            (
                Number(surveysatisfactionscore) +
                Number(surveyusefulnessscore) +
                Number(surveyinstructorscore) +
                Number(surveyrecommendationscore)
            ) / 4
        )
    );
    // Determine survey bucket
    let surveynpsbucket = ""
    if (surveyrecommendationscore == 5) {
        surveynpsbucket = "Promoter";
    } else if (surveyrecommendationscore == 4) {
        surveynpsbucket = "Passive";
    } else {
        surveynpsbucket = "Detractor";
    }

    // Get the eventoccurrenceid
    const selectedDate = eventdatetimestart.split('T')[0];
    const eventoccurrenceRow = await knex('eventoccurrence')
        .where('eventid', eventid)
        .whereRaw('DATE(eventdatetimestart) = ?', [selectedDate])
        .first();

    const eventoccurrenceid = eventoccurrenceRow.eventoccurrenceid;

    // Get the registrationid
    const registrationRow = await knex('registration')
        .where('participantid', participantid)
        .where('eventoccurrenceid', eventoccurrenceid)
        .first();

    const registrationid = registrationRow.registrationid;

    // Put all info together then insert it into database
    const newSurvey = {
        registrationid, surveysatisfactionscore,
        surveyusefulnessscore, surveyinstructorscore,
        surveyrecommendationscore, surveyoverallscore,
        surveynpsbucket, surveycomments, surveysubmissiondate
    };
    knex("survey")
        .insert(newSurvey)
        .then(() => {
            res.render("email", {
                message: "Response submitted!",
                error_message: "",
                username: req.session.username || null,
                level: req.session.level || null,
            });
        })
        .catch((error) => {
            console.log("Survey submit error: ", error);
            res.render("Email", {
                message: "",
                error_message: "Unable to submit survey",
                username: req.session.username || null,
                level: req.session.level || null
            });
        })
});

// Render the milestone form
app.get("/visitorMilestone", (req, res) => {
    res.render("visitorMilestone", {
        message: "",
        error_message: "",
        username: req.session.username || null,
        level: req.session.level || null
    });
});

// Post for the milestone form that uses email to determine participantid
app.post("/visitorMilestone", (req, res) => {
    const { participantemail, milestonetitle, milestonedate } = req.body;
    knex("participant")
        .where("participantemail", participantemail)
        .first()
        .then((participant) => {
            const participantid = participant.participantid;
            const newMilestone = { participantid, milestonetitle, milestonedate };
            knex("milestone")
                .insert(newMilestone)
                .then(() => {
                    res.render("visitorMilestone", {
                        message: "Milestone recorded",
                        error_message: "",
                        username: req.session.username || null,
                        level: req.session.level || null
                    });
                })
                .catch((error) => {
                    console.log("Milestone record error: ", error);
                    res.render("visitorMilestone", {
                        message: "",
                        error_message: "Unable to submit",
                        username: req.session.username || null,
                        level: req.session.level || null
                    });
                })
        })
        .catch((error) => {
            console.log("Participant ID error: ", error);
            res.render("visitorMilestone", {
                message: "",
                error_message: "Cannot find participant",
                username: req.session.username || null,
                level: req.session.level || null
            });
        });
});

// Render donate form
app.get("/visitorDonate", (req, res) => {
    res.render("visitorDonate", {
        message: "",
        error_message: "",
        username: req.session.username || null,
        level: req.session.level || null
    });
});

// Post donate form using email to get participant id
app.post("/visitorDonate", (req, res) => {
    const { participantemail, donationamount, donationdate } = req.body;
    knex("participant")
        .where("participantemail", participantemail)
        .first()
        .then((participant) => {
            const participantid = participant.participantid;
            const newDonate = { participantid, donationamount, donationdate };
            knex("donation")
                .insert(newDonate)
                .then(() => {
                    res.render("visitorDonate", {
                        message: "Donation recorded",
                        error_message: "",
                        username: req.session.username || null,
                        level: req.session.level || null
                    });
                })
                .catch((error) => {
                    console.log("Donation record error: ", error);
                    res.render("visitorDonate", {
                        message: "",
                        error_message: "Unable to submit",
                        username: req.session.username || null,
                        level: req.session.level || null
                    });
                })
        })
        .catch((error) => {
            console.log("Participant ID error: ", error);
            res.render("visitorDonate", {
                message: "",
                error_message: "Cannot find participant",
                username: req.session.username || null,
                level: req.session.level || null
            });
        });
});

// ============== EVENT SURVEYS ROUTES ==============

// Display event surveys page
app.post('/eventSurveys', async (req, res) => {
    const { participantemail } = req.body;
    const participantRow = await knex('participant')
        .where('participantemail', participantemail)
        .first();

    if (!participantRow) {
        res.render('email', {
            username: req.session.username || null,
            level: req.session.level || null,
            error_message: "Invalid Email"
        });
    }

    const participantid = participantRow.participantid;
    try {
        const page = parseInt(req.query.page) || 1;
        const limit = 9; // 9 events per page (3x3 grid)
        const offset = (page - 1) * limit;

        // Build base query
        let baseQuery = knex('event')
            .join('eventoccurrence', 'event.eventid', 'eventoccurrence.eventid')
            .join('registration', 'eventoccurrence.eventoccurrenceid', 'registration.eventoccurrenceid')
            .where('registration.participantid', participantid)
            .whereNotNull('eventoccurrence.eventdatetimestart')
            .select(
                'event.eventid',
                'event.eventname',
                'event.eventtype',
                'event.eventdescription',
                'registration.participantid'
            )
            .distinctOn('event.eventid') // returns one row per eventid
            .orderBy('event.eventid');    // required for DISTINCT ON

        // Get total count
        const countResult = await knex
            .from(baseQuery.clone().as('sub'))
            .count('* as count');

        const totalRecords = parseInt(countResult[0].count, 10);
        const totalPages = Math.ceil(totalRecords / limit);

        // Get paginated results
        const events = await baseQuery.clone()
            .select('*')
            .limit(limit)
            .offset(offset)
            .orderBy('eventname');

        res.render('eventSurveys', {
            username: req.session.username || null,
            level: req.session.level || null,
            events,
            currentPage: page,
            totalPages,
            totalRecords,
            message: req.query.message || null,
            error: req.query.error || null
        });
    } catch (error) {
        console.error('Event Surveys page error:', error);
        res.render('eventSurveys', {
            username: req.session.username || null,
            level: req.session.level || null,
            events: [],
            currentPage: 1,
            totalPages: 1,
            totalRecords: 0,
            message: null,
            error: 'Error loading events'
        });
    }
});

// Display view events page
app.get('/viewEvents', async (req, res) => {
    try {
        const page = parseInt(req.query.page) || 1;
        const limit = 9; // 9 events per page (3x3 grid)
        const offset = (page - 1) * limit;
        const selectedType = req.query.type || '';

        // Build base query
        let baseQuery = knex('event');
        
        if (selectedType) {
            baseQuery = baseQuery.where('eventtype', selectedType);
        }

        // Get unique event types for filter dropdown
        const eventTypesResult = await knex('event')
            .distinct('eventtype')
            .orderBy('eventtype');
        const eventTypes = eventTypesResult.map(row => row.eventtype);

        // Get total count
        const countResult = await baseQuery.clone().count('event.eventid as count');
        const totalRecords = countResult[0].count;
        const totalPages = Math.ceil(totalRecords / limit);

        // Get paginated results
        const events = await baseQuery.clone()
            .select('*')
            .limit(limit)
            .offset(offset)
            .orderBy('eventname');

        res.render('viewEvents', {
            username: req.session.username || null,
            level: req.session.level || null,
            events,
            eventTypes,
            selectedType,
            currentPage: page,
            totalPages,
            totalRecords,
            message: req.query.message || null,
            error: req.query.error || null
        });
    } catch (error) {
        console.error('View Events page error:', error);
        res.render('viewEvents', {
            username: req.session.username || null,
            level: req.session.level || null,
            events: [],
            eventTypes: [],
            selectedType: '',
            currentPage: 1,
            totalPages: 1,
            totalRecords: 0,
            message: null,
            error: 'Error loading events'
        });
    }
});

// ============== PARTICIPANT MILESTONES ROUTE ==============

// Display milestones for a specific participant
app.get('/participantMilestones/:participantid', isAuthenticated, async (req, res) => {
    try {
        const participantId = req.params.participantid;
        const page = parseInt(req.query.page) || 1;
        const limit = 12; // 12 milestones per page
        const offset = (page - 1) * limit;

        // Get participant information
        const participant = await knex('participant')
            .where({ participantid: participantId })
            .first();

        if (!participant) {
            return res.redirect('/participants?error=Participant not found');
        }

        // Build base query for milestones
        let baseQuery = knex('milestone')
            .where({ participantid: participantId });

        // Get total count
        const countResult = await baseQuery.clone().count('milestoneid as count');
        const totalRecords = countResult[0].count;
        const totalPages = Math.ceil(totalRecords / limit);

        // Get paginated milestones
        const milestones = await baseQuery.clone()
            .select('*')
            .limit(limit)
            .offset(offset)
            .orderBy('milestonedate', 'desc');

        res.render('participantMilestones', {
            username: req.session.username,
            level: req.session.level,
            participant,
            milestones,
            currentPage: page,
            totalPages,
            totalRecords,
            message: req.query.message || null,
            error: req.query.error || null
        });
    } catch (error) {
        console.error('Participant Milestones page error:', error);
        res.redirect('/participants?error=Error loading participant milestones');
    }
});

// This is for the teapot requirement
app.get("/teapot", (req, res) => {
    res.sendStatus(418);
});

app.listen(port, () => {
    console.log("The server is listening");
});