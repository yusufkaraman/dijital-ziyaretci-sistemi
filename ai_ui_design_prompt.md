# AI UI Design Prompt for Digital Visitor System

Here is the highly detailed English prompt you can copy and paste into tools like Midjourney, DALL-E 3, v0.dev, or other UI design AI models. It strictly follows the "Simsoft Kurumsal Kimlik Kılavuzu" for typography and color schemes, and explicitly lists the menus and features required on each screen.

***

**Copy the text below this line:**
___

**Role:** Expert UI/UX Designer

**Task:** Design a cohesive, modern, and highly professional web-based "Digital Visitor Management System". The system consists of 5 distinct panels: Lobby Kiosk, Secretary Dashboard, Manager Dashboard, Personnel Dashboard, and Admin Panel. 

**Brand Identity & Styling Guidelines (CRITICAL):**
*   **Typography:** The primary corporate font is "Meta". (Use a clean, modern geometric sans-serif similar to Meta, Fira Sans, or Inter in your design). The UI must have an excellent typographic hierarchy.
*   **Theme & Color Palette (Must follow strictly):**
    *   **Main Theme (Ana Tema):** Clean White. The overarching theme of the user interfaces must be predominantly white, ensuring a very clean, spacious, and bright aesthetic.
    *   **Sub-Theme / Accent (Alt Tema):** Simsoft Blue (Pantone 2935 C / Approx Hex: #0055A4). This blue should be the dominant secondary color, used elegantly for UI accents, active states, prominent primary buttons, and optionally sidebars/headers to contrast with the white main theme.
    *   **Secondary Corporate Color:** Cool Gray 6C (CMYK 0/0/0/40 / Approx Hex: #A7A9AC). Use for secondary elements, structural borders, tables, and muted text.
    *   **Dark Accents & Text:** Black or Cool Gray 11C. Use for primary headings and highly legible body text.
    *   **Backgrounds:** Pristine white backgrounds for all dashboard content areas. Apply modern glassmorphism effects (subtle frosted glass blur) over dark overlays only for modal windows and popups.

---

### Screen 1: Lobby Screen (Self-Service Kiosk)
*   **Orientation/Format:** High-resolution Landscape and Portrait Kiosk display.
*   **Background:** Dynamic, full-screen background (representing corporate imagery or a subtle looping video), heavily relying on glassmorphism for UI elements floating above it.
*   **Top Bar Elements:** Language Selection dropdown (TR/EN), large elegant digital clock & date, and a prominent Weather Widget showing current weather and a 3-day forecast.
*   **Main Registration Form (Glassmorphism Card):**
    *   **Inputs:** "Visitor Name & Surname", "Turkish ID / Passport No" (masked), "Phone Number", "Search Host / Personnel to Visit" (autocomplete dropdown), and "Company Name".
    *   **Checkboxes:** "I have read and accept the GDPR / KVKK policy".
    *   **Call to Action Button:** A prominent, wide "Fast Check-in" (Hızlı Giriş) button in Simsoft Blue.
    *   **Footer/Secondary Action:** "I have an appointment code" button.

### Screen 2: Secretary Panel (Reception Dashboard)
*   **Style:** Data-heavy, spacious, organized, and highly functional.
*   **Top Navigation:** Global Search bar, Notifications Bell (with a red counter badge for newly arrived guests), User Profile, and Logout.
*   **Sidebar Nav Menus:** "Dashboard", "Waiting Visitors", "Checked-in Visitors", "Expected/Scheduled Visitors", "Manual Visitor Entry", "Visitor History".
*   **Core UI Features (Dashboard/List View):**
    *   **Data Table:** Columns for "Visitor Name", "Host/Employee Name", "Arrival Time", "Scheduled Time", and "Status Badges" (Waiting, Inside, Completed).
    *   **Inline Actions:** Each row must have modern icon-based buttons: "Approve Entry", "Reject", "Direct to Meeting Room", and "Check-out".
    *   **FAB / Top Action:** A prominent "Register New Visitor manually" button.

### Screen 3: Manager Panel (Executive Dashboard)
*   **Style:** Executive, clean, minimalistic, focused entirely on a quick overview and immediate actions. No unnecessary system data.
*   **Top Navigation:** Notifications icon and Profile shortcut.
*   **Sidebar Nav Menus:** "My Dashboard", "My Appointments", "My Visitor History".
*   **Core UI Features:**
    *   **Summary Cards (Top):** "Total Expected Today", "Currently in Meeting", "Waiting at Reception".
    *   **My Appointments List:** A sleek vertical timeline or card-based view showing the schedule of guests arriving for this specific manager today.
    *   **Arrival Alert Modal:** A critical feature: A full-screen darkened overlay (100% background blur to hide all white space) containing a clean white modal card reading: "Your VIP Visitor has arrived at Reception." Buttons: "Approve Entry", "Reject", "Busy - Wait 5 mins".

### Screen 4: Personnel Panel (Employee Dashboard)
*   **Style:** Friendly, straightforward, task-oriented.
*   **Top Navigation:** Notifications specifically for their own visitors.
*   **Sidebar Nav Menus:** "Invite a Visitor", "My Expected Visitors", "My Past Visitors".
*   **Core UI Features:**
    *   **Invitation Form View:** A clean, intuitive card layout with fields: "Guest Full Name", "Guest Email", "Guest Phone", "Date Picker Calendar", "Time Picker", "Select Meeting Room" (dropdown), and "Additional Notes". Button: "Send Invitation".
    *   **Upcoming Visitors Grid:** A card grid showing invited guests with bold "Status Badges" (e.g., "Not Arrived", "Waiting at Reception", "Inside").

### Screen 5: Admin Panel (System Configuration)
*   **Style:** Technical, structured, and dense with configuration options.
*   **Top Navigation:** Global system alerts, Admin Profile.
*   **Sidebar Nav Menus:** "Global Dashboard", "User Management" (Manage Admins/Secretaries/Managers), "Personnel Records" (All employees), "Meeting Rooms Setup", "Lobby Media Formats", "System Settings".
*   **Core UI Features:**
    *   **Data Tables:** Advanced tables with pagination, Excel Export/Import buttons, Search bars, Filters, and Action menus (Edit details / Delete).
    *   **Lobby Media Manager (Specific View):** A visual drag-and-drop file upload area for updating the Lobby background videos/images, along with a gallery showing currently active media.
    *   **Add New Form:** A slide-out panel or centered modal to "Add New User" with fields for Name, Role mapping, and Email.

---
**Designer Instruction:** Output high-fidelity, photorealistic UI/UX web and kiosk designs. Pay deep attention to the specific sidebar menus, buttons, and form fields requested for each panel. Prioritize visual excellence, rich aesthetics, dynamic layouts, harmonious integration of the specified blue and gray colors, smooth modern gradients, and clear, structured spacing. Do not use generic colors; stick strictly to the palette provided.
