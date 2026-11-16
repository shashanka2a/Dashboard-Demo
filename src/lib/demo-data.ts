/**
 * Realistic Demo Data & In-Memory Store for Utility Vision Dashboard.
 * Powers the interactive demo environment with realistic utility, energy, and vegetation management data.
 */

export interface DemoProject {
  id: string;
  name: string;
  job_number: string;
  client_name?: string;
  acres_completed: number;
  last_activity: string | null;
  status: 'active' | 'paused' | 'completed';
  street_address?: string;
  city?: string;
  state?: string;
  zip_code?: string;
  country?: string;
  start_date?: string;
  end_date?: string;
  project_groups?: string;
  project_template?: string;
  created_at?: string;
  contract_po?: string | null;
  contract_expiration?: string | null;
  wickd_contact_employee_id?: string | null;
  superintendent_name?: string | null;
  superintendent_phone?: string | null;
  gate_code?: string | null;
}

export interface DemoEmployee {
  id: string;
  name: string;
  role: string;
  status: 'active' | 'inactive';
  assigned_projects: string[];
  email?: string;
  phone?: string;
  employee_id?: string;
  classification?: string;
  photo_url?: string;
  created_at?: string;
}

export interface DemoClient {
  id: string;
  name: string;
  company_name: string | null;
  email: string | null;
  phone: string | null;
  title: string | null;
  notes: string | null;
  status: 'active' | 'inactive';
  project_ids: string[];
  project_names: string[];
  street_address: string | null;
  city: string | null;
  state: string | null;
  zip_code: string | null;
  created_at?: string;
}

export interface DemoActivity {
  id: string;
  employeeName: string;
  action: string;
  project: string;
  activityType: string;
  timestamp: string;
  isoTimestamp: string;
  reportDateYmd?: string | null;
  metrics: { label: string; value: string; unit: string; highlight?: boolean; id?: string }[];
  photos: string[];
  submittedDateYmd?: string;
  selectedDateYmd?: string;
}

export interface DemoIncident {
  id: string;
  title: string;
  status: string;
  recordable: boolean;
  incident_date: string;
  display_date: string;
  location: string;
  description: string;
  injury_illness_type: string;
  injured_names: string[];
  injured_employee_info?: Array<{
    name: string;
    treatment?: string;
    work_days_lost?: number;
    restricted_days?: number;
    return_to_work_date?: string;
  }>;
  employee_info_incomplete?: boolean;
  project_name: string;
  project_id?: string;
  logged_at: string;
  photos: string[];
}

export interface DemoObservation {
  id: string;
  description: string;
  category: string;
  severity: string;
  status: string;
  project_name: string;
  observer_name: string;
  logged_at: string;
  corrective_action?: string;
}

export interface DemoReport {
  id: string;
  projectName: string;
  projectId?: string | null;
  date: string;
  timestamp: string;
  reportSigned: boolean;
  weather: {
    high: number;
    low: number;
    condition: 'sunny' | 'rainy' | 'cloudy';
  };
  photos: string[];
  delays: number;
}

export const INITIAL_DEMO_PROJECTS: DemoProject[] = [
  {
    id: 'proj-001',
    name: 'Everglades Solar Corridor - Phase II',
    job_number: 'JOB-2026-081',
    client_name: 'NextEra Energy Resources',
    acres_completed: 432.5,
    last_activity: '10 minutes ago',
    status: 'active',
    street_address: '12400 SW Krome Ave',
    city: 'Miami',
    state: 'Florida',
    zip_code: '33196',
    country: 'United States',
    start_date: '2026-01-15',
    end_date: '2026-08-30',
    project_template: 'Wicking Jobs Template | Company default template',
    contract_po: 'PO-88219-NE',
    contract_expiration: '2026-12-31',
    wickd_contact_employee_id: 'emp-001',
    superintendent_name: 'Dave Miller',
    superintendent_phone: '(305) 555-0142',
    gate_code: '#4421',
    created_at: '2026-01-10T08:00:00Z',
  },
  {
    id: 'proj-002',
    name: 'Suncoast Transmission ROW Clearing',
    job_number: 'JOB-2026-044',
    client_name: 'Florida Power & Light',
    acres_completed: 218.0,
    last_activity: '45 minutes ago',
    status: 'active',
    street_address: '7850 State Road 52',
    city: 'Hudson',
    state: 'Florida',
    zip_code: '34669',
    country: 'United States',
    start_date: '2026-02-01',
    end_date: '2026-06-15',
    project_template: 'Infrastructure Template',
    contract_po: 'PO-77341-FPL',
    contract_expiration: '2026-10-15',
    wickd_contact_employee_id: 'emp-002',
    superintendent_name: 'Marcus Vance',
    superintendent_phone: '(727) 555-0199',
    gate_code: '#9021',
    created_at: '2026-01-25T09:30:00Z',
  },
  {
    id: 'proj-003',
    name: 'Ocala Substation Vegetation Mgmt',
    job_number: 'JOB-2026-019',
    client_name: 'Duke Energy Florida',
    acres_completed: 94.2,
    last_activity: '2 hours ago',
    status: 'active',
    street_address: '4501 SW 60th Ave',
    city: 'Ocala',
    state: 'Florida',
    zip_code: '34474',
    country: 'United States',
    start_date: '2026-02-15',
    end_date: '2026-05-30',
    project_template: 'Environmental Project Template',
    contract_po: 'PO-55120-DEF',
    contract_expiration: '2026-09-01',
    wickd_contact_employee_id: 'emp-003',
    superintendent_name: 'Sarah Jenkins',
    superintendent_phone: '(352) 555-0118',
    gate_code: '#1187',
    created_at: '2026-02-05T11:00:00Z',
  },
  {
    id: 'proj-004',
    name: 'St. Johns River Canal Access Restoration',
    job_number: 'JOB-2025-112',
    client_name: 'St. Johns River WMD',
    acres_completed: 380.0,
    last_activity: '3 days ago',
    status: 'completed',
    street_address: '4049 Reid St',
    city: 'Palatka',
    state: 'Florida',
    zip_code: '32177',
    country: 'United States',
    start_date: '2025-09-01',
    end_date: '2026-02-28',
    project_template: 'Environmental Project Template',
    contract_po: 'PO-39912-SJR',
    contract_expiration: '2026-03-31',
    wickd_contact_employee_id: 'emp-001',
    superintendent_name: 'Brad Wickstrom',
    superintendent_phone: '(904) 796-7790',
    gate_code: '#5542',
    created_at: '2025-08-20T14:15:00Z',
  },
  {
    id: 'proj-005',
    name: 'Tampa Electric Grid Resiliency Right-of-Way',
    job_number: 'JOB-2026-092',
    client_name: 'Tampa Electric',
    acres_completed: 165.8,
    last_activity: '5 hours ago',
    status: 'active',
    street_address: '702 N Franklin St',
    city: 'Tampa',
    state: 'Florida',
    zip_code: '33602',
    country: 'United States',
    start_date: '2026-01-20',
    end_date: '2026-07-31',
    project_template: 'Infrastructure Template',
    contract_po: 'PO-66290-TECO',
    contract_expiration: '2026-11-30',
    wickd_contact_employee_id: 'emp-002',
    superintendent_name: 'Marcus Vance',
    superintendent_phone: '(813) 555-0188',
    gate_code: '#8899',
    created_at: '2026-01-18T16:00:00Z',
  },
  {
    id: 'proj-006',
    name: 'Biscayne Bay Mitigation Zone Habitat Care',
    job_number: 'JOB-2026-033',
    client_name: 'Apex Clean Energy',
    acres_completed: 52.0,
    last_activity: '1 day ago',
    status: 'paused',
    street_address: '9700 SW 344th St',
    city: 'Homestead',
    state: 'Florida',
    zip_code: '33035',
    country: 'United States',
    start_date: '2026-02-10',
    end_date: '2026-04-30',
    project_template: 'Environmental Project Template',
    contract_po: 'PO-44810-APX',
    contract_expiration: '2026-06-30',
    wickd_contact_employee_id: 'emp-004',
    superintendent_name: 'Dave Miller',
    superintendent_phone: '(305) 555-0142',
    gate_code: '#2204',
    created_at: '2026-02-01T10:00:00Z',
  },
];

export const INITIAL_DEMO_EMPLOYEES: DemoEmployee[] = [
  {
    id: 'emp-001',
    name: 'Brad Wickstrom',
    role: 'account_admin',
    status: 'active',
    assigned_projects: ['proj-001', 'proj-002', 'proj-003', 'proj-004', 'proj-005', 'proj-006'],
    email: 'brad@wickd-fl.com',
    phone: '(904) 796-7790',
    employee_id: 'EMP-001',
    classification: 'Owner / Executive Director',
    created_at: '2025-01-01T00:00:00Z',
  },
  {
    id: 'emp-002',
    name: 'Marcus Vance',
    role: 'project_admin',
    status: 'active',
    assigned_projects: ['proj-001', 'proj-002', 'proj-005'],
    email: 'marcus.v@wickd-fl.com',
    phone: '(904) 555-0182',
    employee_id: 'EMP-002',
    classification: 'Operations Director',
    created_at: '2025-02-10T00:00:00Z',
  },
  {
    id: 'emp-003',
    name: 'Sarah Jenkins',
    role: 'project_member',
    status: 'active',
    assigned_projects: ['proj-003', 'proj-004'],
    email: 'sarah.j@wickd-fl.com',
    phone: '(352) 555-0144',
    employee_id: 'EMP-003',
    classification: 'Environmental Compliance Officer',
    created_at: '2025-03-01T00:00:00Z',
  },
  {
    id: 'emp-004',
    name: 'Dave Miller',
    role: 'project_member',
    status: 'active',
    assigned_projects: ['proj-001', 'proj-006'],
    email: 'dave.m@wickd-fl.com',
    phone: '(305) 555-0163',
    employee_id: 'EMP-004',
    classification: 'Field Superintendent',
    created_at: '2025-03-15T00:00:00Z',
  },
  {
    id: 'emp-005',
    name: 'Carlos Mendez',
    role: 'worker',
    status: 'active',
    assigned_projects: ['proj-001', 'proj-002'],
    email: 'carlos.m@wickd-fl.com',
    phone: '(786) 555-0199',
    employee_id: 'EMP-005',
    classification: 'Heavy Equipment Specialist',
    created_at: '2025-04-01T00:00:00Z',
  },
  {
    id: 'emp-006',
    name: 'Jamal Washington',
    role: 'worker',
    status: 'active',
    assigned_projects: ['proj-002', 'proj-005'],
    email: 'jamal.w@wickd-fl.com',
    phone: '(813) 555-0122',
    employee_id: 'EMP-006',
    classification: 'Skid Steer Operator & Applicator',
    created_at: '2025-04-10T00:00:00Z',
  },
  {
    id: 'emp-007',
    name: 'Savannah Bell',
    role: 'account_admin',
    status: 'active',
    assigned_projects: ['proj-001', 'proj-002', 'proj-003', 'proj-004', 'proj-005', 'proj-006'],
    email: 'savannah@wickd-fl.com',
    phone: '(904) 796-7791',
    employee_id: 'EMP-007',
    classification: 'Safety & Quality Assurance Lead',
    created_at: '2025-01-15T00:00:00Z',
  },
  {
    id: 'emp-008',
    name: 'Elena Rostova',
    role: 'project_member',
    status: 'active',
    assigned_projects: ['proj-001', 'proj-003'],
    email: 'elena.r@wickd-fl.com',
    phone: '(407) 555-0177',
    employee_id: 'EMP-008',
    classification: 'GIS & Field Mapping Analyst',
    created_at: '2025-05-20T00:00:00Z',
  },
];

export const INITIAL_DEMO_CLIENTS: DemoClient[] = [
  {
    id: 'cli-001',
    name: 'NextEra Energy Resources',
    company_name: 'NextEra Energy, Inc.',
    email: 'corridor.ops@nexteraenergy.com',
    phone: '(561) 694-4000',
    title: 'Director of Utility Infrastructure',
    notes: 'Priority solar corridor client. Active portal permissions for daily reports, GPS tracks, and treatment metrics.',
    status: 'active',
    project_ids: ['proj-001'],
    project_names: ['Everglades Solar Corridor - Phase II'],
    street_address: '700 Universe Blvd',
    city: 'Juno Beach',
    state: 'Florida',
    zip_code: '33408',
    created_at: '2026-01-05T00:00:00Z',
  },
  {
    id: 'cli-002',
    name: 'Florida Power & Light',
    company_name: 'Florida Power & Light Co.',
    email: 'transmission.row@fpl.com',
    phone: '(800) 375-2434',
    title: 'Transmission ROW Program Manager',
    notes: 'Strict NERC standard compliance required. Full photo documentation demanded on each tower span.',
    status: 'active',
    project_ids: ['proj-002'],
    project_names: ['Suncoast Transmission ROW Clearing'],
    street_address: '4200 W Flagler St',
    city: 'Coral Gables',
    state: 'Florida',
    zip_code: '33134',
    created_at: '2026-01-12T00:00:00Z',
  },
  {
    id: 'cli-003',
    name: 'Duke Energy Florida',
    company_name: 'Duke Energy Corporation',
    email: 'fl.substations@duke-energy.com',
    phone: '(800) 700-8744',
    title: 'Substation Security & Environmental Lead',
    notes: 'Quarterly herbicide barrier maintenance around high-voltage equipment perimeter.',
    status: 'active',
    project_ids: ['proj-003'],
    project_names: ['Ocala Substation Vegetation Mgmt'],
    street_address: '299 1st Ave N',
    city: 'St. Petersburg',
    state: 'Florida',
    zip_code: '33701',
    created_at: '2026-01-20T00:00:00Z',
  },
  {
    id: 'cli-004',
    name: 'St. Johns River WMD',
    company_name: 'St. Johns River Water Management District',
    email: 'waterways@sjrwmd.com',
    phone: '(386) 329-4500',
    title: 'Aquatic Habitat Specialist',
    notes: 'Canal access completed on schedule. Invasive cattail and Brazilian pepper suppression verified.',
    status: 'active',
    project_ids: ['proj-004'],
    project_names: ['St. Johns River Canal Access Restoration'],
    street_address: '4049 Reid St',
    city: 'Palatka',
    state: 'Florida',
    zip_code: '32177',
    created_at: '2025-08-15T00:00:00Z',
  },
  {
    id: 'cli-005',
    name: 'Tampa Electric',
    company_name: 'TECO Energy Inc.',
    email: 'grid.resiliency@tecoenergy.com',
    phone: '(813) 228-4111',
    title: 'Grid Hardening Project Sponsor',
    notes: 'Multi-mile feeder clearing project. Weekly milestone review required.',
    status: 'active',
    project_ids: ['proj-005'],
    project_names: ['Tampa Electric Grid Resiliency Right-of-Way'],
    street_address: '702 N Franklin St',
    city: 'Tampa',
    state: 'Florida',
    zip_code: '33602',
    created_at: '2026-01-16T00:00:00Z',
  },
  {
    id: 'cli-006',
    name: 'Apex Clean Energy',
    company_name: 'Apex Clean Energy Holdings LLC',
    email: 'environmental@apexcleanenergy.com',
    phone: '(434) 220-7595',
    title: 'Asset Manager',
    notes: 'Project temporarily paused awaiting seasonal bird nesting clearance window.',
    status: 'active',
    project_ids: ['proj-006'],
    project_names: ['Biscayne Bay Mitigation Zone Habitat Care'],
    street_address: '310 4th St NE',
    city: 'Charlottesville',
    state: 'Virginia',
    zip_code: '22902',
    created_at: '2026-01-30T00:00:00Z',
  },
];

export const INITIAL_DEMO_ACTIVITIES: DemoActivity[] = [
  {
    id: 'act-001',
    employeeName: 'Dave Miller',
    action: 'Logged Daily Metrics & Machine Runtime',
    project: 'Everglades Solar Corridor - Phase II',
    activityType: 'Metrics',
    timestamp: '15 minutes ago',
    isoTimestamp: new Date(Date.now() - 15 * 60 * 1000).toISOString(),
    reportDateYmd: new Date().toISOString().split('T')[0],
    metrics: [
      { label: 'Area Treated', value: '18.4', unit: 'acres', highlight: true },
      { label: 'Machine Runtime', value: '7.5', unit: 'hrs' },
      { label: 'Diesel Fuel', value: '42.0', unit: 'gal' },
      { label: 'Linear ROW', value: '3,850', unit: 'ft' },
    ],
    photos: [
      'https://images.unsplash.com/photo-1542314831-068cd1dbfeeb?auto=format&fit=crop&w=800&q=80',
      'https://images.unsplash.com/photo-1500382017468-9049fed747ef?auto=format&fit=crop&w=800&q=80',
    ],
  },
  {
    id: 'act-002',
    employeeName: 'Carlos Mendez',
    action: 'Targeted Chemical Application (Selective Wicking)',
    project: 'Everglades Solar Corridor - Phase II',
    activityType: 'Chemicals',
    timestamp: '45 minutes ago',
    isoTimestamp: new Date(Date.now() - 45 * 60 * 1000).toISOString(),
    reportDateYmd: new Date().toISOString().split('T')[0],
    metrics: [
      { label: 'Herbicide Mix', value: 'Garlon 4 Ultra', unit: 'EPA# 62719-527', highlight: true },
      { label: 'Concentration', value: '3.5', unit: '%' },
      { label: 'Total Volume', value: '65.0', unit: 'gal' },
      { label: 'Target Specie', value: 'Melaleuca / Brazilian Pepper', unit: '' },
    ],
    photos: [
      'https://images.unsplash.com/photo-1589939705384-5185137a7f0f?auto=format&fit=crop&w=800&q=80',
    ],
  },
  {
    id: 'act-003',
    employeeName: 'Marcus Vance',
    action: 'Completed Pre-Operational Equipment Checklist',
    project: 'Suncoast Transmission ROW Clearing',
    activityType: 'Checklists',
    timestamp: '1 hour ago',
    isoTimestamp: new Date(Date.now() - 60 * 60 * 1000).toISOString(),
    reportDateYmd: new Date().toISOString().split('T')[0],
    metrics: [
      { label: 'Unit', value: 'Kubota SVL97-2 Track Loader #04', unit: '', highlight: true },
      { label: 'Hydraulics', value: 'Pass (No leaks)', unit: '' },
      { label: 'Fire Extinguisher', value: 'Inspected & Charged', unit: '' },
      { label: 'Track Tension', value: '35 mm spec', unit: '' },
    ],
    photos: [
      'https://images.unsplash.com/photo-1578328819058-b69f3a3b0f6b?auto=format&fit=crop&w=800&q=80',
    ],
  },
  {
    id: 'act-004',
    employeeName: 'Savannah Bell',
    action: 'Conducted Job Safety Analysis & Toolbox Talk',
    project: 'Suncoast Transmission ROW Clearing',
    activityType: 'Safety Talks',
    timestamp: '2 hours ago',
    isoTimestamp: new Date(Date.now() - 120 * 60 * 1000).toISOString(),
    reportDateYmd: new Date().toISOString().split('T')[0],
    metrics: [
      { label: 'Topic', value: 'High-Voltage Minimum Approach Distances (MAD)', unit: '', highlight: true },
      { label: 'Crew Present', value: '7', unit: 'workers' },
      { label: 'Overhead Clearance', value: '25 ft verified', unit: '' },
      { label: 'All Signatures', value: '100% Signed', unit: '' },
    ],
    photos: [
      'https://images.unsplash.com/photo-1504384308090-c894fdcc538d?auto=format&fit=crop&w=800&q=80',
    ],
  },
  {
    id: 'act-005',
    employeeName: 'Sarah Jenkins',
    action: 'Recorded Environmental Habitat Observation',
    project: 'Ocala Substation Vegetation Mgmt',
    activityType: 'Observations',
    timestamp: '3 hours ago',
    isoTimestamp: new Date(Date.now() - 180 * 60 * 1000).toISOString(),
    reportDateYmd: new Date().toISOString().split('T')[0],
    metrics: [
      { label: 'Category', value: 'Wildlife Protection', unit: '', highlight: true },
      { label: 'Finding', value: 'Active Gopher Tortoise Burrow Flagged', unit: '' },
      { label: 'Buffer Zone', value: '25 ft Exclusion Radius', unit: '' },
      { label: 'Crew Briefed', value: 'Yes', unit: '' },
    ],
    photos: [
      'https://images.unsplash.com/photo-1470071459604-3b5ec3a7fe05?auto=format&fit=crop&w=800&q=80',
    ],
  },
  {
    id: 'act-006',
    employeeName: 'Marcus Vance',
    action: 'Safety Incident Resolved - Minor Equipment Seepage',
    project: 'Tampa Electric Grid Resiliency Right-of-Way',
    activityType: 'Incidents',
    timestamp: '4 hours ago',
    isoTimestamp: new Date(Date.now() - 240 * 60 * 1000).toISOString(),
    reportDateYmd: new Date().toISOString().split('T')[0],
    metrics: [
      { label: 'Status', value: 'Resolved & Closed', unit: '', highlight: true },
      { label: 'OSHA Recordable', value: 'No', unit: '' },
      { label: 'Environmental Impact', value: 'Zero (100% Contained)', unit: '' },
      { label: 'Root Cause', value: 'O-Ring Wear at Quick-Disconnect', unit: '' },
    ],
    photos: [
      'https://images.unsplash.com/photo-1581092160607-ee22621dd758?auto=format&fit=crop&w=800&q=80',
    ],
  },
  {
    id: 'act-007',
    employeeName: 'Brad Wickstrom',
    action: 'Approved & Signed Daily Superintendent Report',
    project: 'Everglades Solar Corridor - Phase II',
    activityType: 'Reports',
    timestamp: '5 hours ago',
    isoTimestamp: new Date(Date.now() - 300 * 60 * 1000).toISOString(),
    reportDateYmd: new Date().toISOString().split('T')[0],
    metrics: [
      { label: 'Report Status', value: 'Digitally Signed', unit: '', highlight: true },
      { label: 'Weather', value: '82°F / Clear', unit: '' },
      { label: 'Production Score', value: '104%', unit: 'target' },
      { label: 'Delays', value: '0.0', unit: 'hrs' },
    ],
    photos: [
      'https://images.unsplash.com/photo-1509391365360-2e959784a276?auto=format&fit=crop&w=800&q=80',
    ],
  },
];

export const INITIAL_DEMO_INCIDENTS: DemoIncident[] = [
  {
    id: 'inc-001',
    title: 'Hydraulic fluid seepage contained during mowing',
    status: 'open',
    recordable: false,
    incident_date: new Date(Date.now() - 2 * 86400000).toISOString().split('T')[0],
    display_date: 'Mar 12, 2026',
    location: 'Everglades Solar Corridor - Section B4',
    description: 'Auxiliary hydraulic hose coupling showed minor weeping under pressure. Machine was shut down instantly. Spill kit deployed; zero environmental release.',
    injury_illness_type: 'None - Equipment Mechanical',
    injured_names: [],
    injured_employee_info: [],
    employee_info_incomplete: false,
    project_name: 'Everglades Solar Corridor - Phase II',
    project_id: 'proj-001',
    logged_at: new Date(Date.now() - 2 * 86400000).toISOString(),
    photos: ['https://images.unsplash.com/photo-1581092160607-ee22621dd758?auto=format&fit=crop&w=800&q=80'],
  },
  {
    id: 'inc-002',
    title: 'Ground-nesting yellowjacket reaction on right-of-way',
    status: 'under_investigation',
    recordable: false,
    incident_date: new Date(Date.now() - 5 * 86400000).toISOString().split('T')[0],
    display_date: 'Mar 09, 2026',
    location: 'Suncoast Transmission ROW - Span 42',
    description: 'Operator Carlos Mendez received two stings while trimming brush near guy wire anchor. First aid cold pack applied; operator cleared for duty after 30 min observation.',
    injury_illness_type: 'Insect Sting / First Aid',
    injured_names: ['Carlos Mendez'],
    injured_employee_info: [
      {
        name: 'Carlos Mendez',
        treatment: 'First Aid Only (Ice pack and antihistamine wash)',
        work_days_lost: 0,
        restricted_days: 0,
        return_to_work_date: new Date(Date.now() - 5 * 86400000).toISOString().split('T')[0],
      },
    ],
    employee_info_incomplete: false,
    project_name: 'Suncoast Transmission ROW Clearing',
    project_id: 'proj-002',
    logged_at: new Date(Date.now() - 5 * 86400000).toISOString(),
    photos: ['https://images.unsplash.com/photo-1504384308090-c894fdcc538d?auto=format&fit=crop&w=800&q=80'],
  },
  {
    id: 'inc-003',
    title: 'Guy wire anchor tripping hazard flagged and mitigated',
    status: 'closed',
    recordable: false,
    incident_date: new Date(Date.now() - 14 * 86400000).toISOString().split('T')[0],
    display_date: 'Feb 28, 2026',
    location: 'Ocala Substation Perimeter Access',
    description: 'Overgrown ground anchor partially obscured by cogon grass. Crew flagged area, installed high-visibility safety sleeve, and mowed perimeter cleanly.',
    injury_illness_type: 'Near Miss / Hazard Identification',
    injured_names: [],
    injured_employee_info: [],
    employee_info_incomplete: false,
    project_name: 'Ocala Substation Vegetation Mgmt',
    project_id: 'proj-003',
    logged_at: new Date(Date.now() - 14 * 86400000).toISOString(),
    photos: ['https://images.unsplash.com/photo-1542314831-068cd1dbfeeb?auto=format&fit=crop&w=800&q=80'],
  },
];

export const INITIAL_DEMO_REPORTS: DemoReport[] = [
  {
    id: 'rep-001',
    projectName: 'Everglades Solar Corridor - Phase II',
    projectId: 'proj-001',
    date: new Date().toISOString().split('T')[0],
    timestamp: 'Today, 4:30 PM',
    reportSigned: true,
    weather: { high: 84, low: 68, condition: 'sunny' },
    photos: [
      'https://images.unsplash.com/photo-1509391365360-2e959784a276?auto=format&fit=crop&w=800&q=80',
      'https://images.unsplash.com/photo-1542314831-068cd1dbfeeb?auto=format&fit=crop&w=800&q=80',
    ],
    delays: 0,
  },
  {
    id: 'rep-002',
    projectName: 'Suncoast Transmission ROW Clearing',
    projectId: 'proj-002',
    date: new Date().toISOString().split('T')[0],
    timestamp: 'Today, 3:15 PM',
    reportSigned: true,
    weather: { high: 81, low: 64, condition: 'sunny' },
    photos: [
      'https://images.unsplash.com/photo-1500382017468-9049fed747ef?auto=format&fit=crop&w=800&q=80',
    ],
    delays: 0,
  },
  {
    id: 'rep-003',
    projectName: 'Ocala Substation Vegetation Mgmt',
    projectId: 'proj-003',
    date: new Date(Date.now() - 86400000).toISOString().split('T')[0],
    timestamp: 'Yesterday, 5:00 PM',
    reportSigned: true,
    weather: { high: 79, low: 60, condition: 'cloudy' },
    photos: [
      'https://images.unsplash.com/photo-1578328819058-b69f3a3b0f6b?auto=format&fit=crop&w=800&q=80',
    ],
    delays: 0.5,
  },
  {
    id: 'rep-004',
    projectName: 'Tampa Electric Grid Resiliency Right-of-Way',
    projectId: 'proj-005',
    date: new Date(Date.now() - 86400000).toISOString().split('T')[0],
    timestamp: 'Yesterday, 4:45 PM',
    reportSigned: false,
    weather: { high: 82, low: 66, condition: 'sunny' },
    photos: [
      'https://images.unsplash.com/photo-1589939705384-5185137a7f0f?auto=format&fit=crop&w=800&q=80',
    ],
    delays: 0,
  },
  {
    id: 'rep-005',
    projectName: 'Everglades Solar Corridor - Phase II',
    projectId: 'proj-001',
    date: new Date(Date.now() - 2 * 86400000).toISOString().split('T')[0],
    timestamp: '2 days ago',
    reportSigned: true,
    weather: { high: 83, low: 67, condition: 'sunny' },
    photos: [
      'https://images.unsplash.com/photo-1504384308090-c894fdcc538d?auto=format&fit=crop&w=800&q=80',
    ],
    delays: 0,
  },
];

export const DEMO_COMPANY_SETTINGS = {
  company_name: "Wick'd Environmental Technologies",
  company_phone: '+1 (904) 796-7790',
  company_email: 'brad@wickd-fl.com',
  cc_emails: 'savannah@wickd-fl.com',
  industry: 'Utility Vegetation Management',
  sub_industry: 'Selective Herbicide & Mechanical ROW Clearing',
  employee_range: '25-100',
  search_address: '864 Southwest Spirit Avenue, Fort White, Florida 32038',
  street_address: '864 Southwest Spirit Avenue',
  city: 'Fort White',
  state: 'Florida',
  zip_code: '32038',
  country: 'United States',
  report_language: 'English',
  brand_color: '#FF6633',
  logo_url: null,
  logo_public_id: null,
};

// ── In-Memory / Local Storage Store ──────────────────────────────────────────

const DEMO_STORAGE_KEY = 'uv_demo_store_v1';

class DemoStore {
  projects: DemoProject[] = [...INITIAL_DEMO_PROJECTS];
  employees: DemoEmployee[] = [...INITIAL_DEMO_EMPLOYEES];
  clients: DemoClient[] = [...INITIAL_DEMO_CLIENTS];
  activities: DemoActivity[] = [...INITIAL_DEMO_ACTIVITIES];
  incidents: DemoIncident[] = [...INITIAL_DEMO_INCIDENTS];
  reports: DemoReport[] = [...INITIAL_DEMO_REPORTS];
  companySettings = { ...DEMO_COMPANY_SETTINGS };

  constructor() {
    this.loadFromStorage();
  }

  loadFromStorage() {
    if (typeof window === 'undefined') return;
    try {
      const raw = localStorage.getItem(DEMO_STORAGE_KEY);
      if (raw) {
        const parsed = JSON.parse(raw);
        if (parsed.projects) this.projects = parsed.projects;
        if (parsed.employees) this.employees = parsed.employees;
        if (parsed.clients) this.clients = parsed.clients;
        if (parsed.activities) this.activities = parsed.activities;
        if (parsed.incidents) this.incidents = parsed.incidents;
        if (parsed.reports) this.reports = parsed.reports;
        if (parsed.companySettings) this.companySettings = parsed.companySettings;
      }
    } catch {
      /* ignore */
    }
  }

  saveToStorage() {
    if (typeof window === 'undefined') return;
    try {
      localStorage.setItem(
        DEMO_STORAGE_KEY,
        JSON.stringify({
          projects: this.projects,
          employees: this.employees,
          clients: this.clients,
          activities: this.activities,
          incidents: this.incidents,
          reports: this.reports,
          companySettings: this.companySettings,
        })
      );
    } catch {
      /* ignore */
    }
  }

  reset() {
    this.projects = [...INITIAL_DEMO_PROJECTS];
    this.employees = [...INITIAL_DEMO_EMPLOYEES];
    this.clients = [...INITIAL_DEMO_CLIENTS];
    this.activities = [...INITIAL_DEMO_ACTIVITIES];
    this.incidents = [...INITIAL_DEMO_INCIDENTS];
    this.reports = [...INITIAL_DEMO_REPORTS];
    this.companySettings = { ...DEMO_COMPANY_SETTINGS };
    if (typeof window !== 'undefined') {
      localStorage.removeItem(DEMO_STORAGE_KEY);
    }
  }

  addProject(project: Partial<DemoProject>): DemoProject {
    const newProject: DemoProject = {
      id: `proj-${Date.now()}`,
      name: project.name || 'New Demo Project',
      job_number: project.job_number || `JOB-${Date.now().toString().slice(-4)}`,
      client_name: project.client_name || 'Utility Partner',
      acres_completed: Number(project.acres_completed || 0),
      last_activity: 'Just now',
      status: (project.status as DemoProject['status']) || 'active',
      street_address: project.street_address || '',
      city: project.city || '',
      state: project.state || '',
      zip_code: project.zip_code || '',
      country: project.country || 'United States',
      start_date: project.start_date || new Date().toISOString().split('T')[0],
      end_date: project.end_date || '',
      project_template: project.project_template || 'Wicking Jobs Template',
      contract_po: project.contract_po || '',
      contract_expiration: project.contract_expiration || '',
      wickd_contact_employee_id: project.wickd_contact_employee_id || null,
      superintendent_name: project.superintendent_name || null,
      superintendent_phone: project.superintendent_phone || null,
      gate_code: project.gate_code || null,
      created_at: new Date().toISOString(),
    };
    this.projects = [newProject, ...this.projects];
    this.saveToStorage();
    return newProject;
  }

  updateProject(id: string, patch: Partial<DemoProject>): DemoProject | null {
    const idx = this.projects.findIndex((p) => p.id === id);
    if (idx === -1) return null;
    this.projects[idx] = { ...this.projects[idx], ...patch };
    this.saveToStorage();
    return this.projects[idx];
  }

  addEmployee(employee: Partial<DemoEmployee>): DemoEmployee {
    const newEmp: DemoEmployee = {
      id: `emp-${Date.now()}`,
      name: employee.name || 'New Team Member',
      role: employee.role || 'project_member',
      status: employee.status || 'active',
      assigned_projects: employee.assigned_projects || [],
      email: employee.email || '',
      phone: employee.phone || '',
      employee_id: employee.employee_id || `EMP-${Date.now().toString().slice(-3)}`,
      classification: employee.classification || 'Field Specialist',
      created_at: new Date().toISOString(),
    };
    this.employees = [...this.employees, newEmp];
    this.saveToStorage();
    return newEmp;
  }

  addClient(client: Partial<DemoClient>): DemoClient {
    const newClient: DemoClient = {
      id: `cli-${Date.now()}`,
      name: client.name || 'New Enterprise Client',
      company_name: client.company_name || client.name || '',
      email: client.email || '',
      phone: client.phone || '',
      title: client.title || 'Project Manager',
      notes: client.notes || '',
      status: client.status || 'active',
      project_ids: client.project_ids || [],
      project_names: client.project_names || [],
      street_address: client.street_address || '',
      city: client.city || '',
      state: client.state || '',
      zip_code: client.zip_code || '',
      created_at: new Date().toISOString(),
    };
    this.clients = [...this.clients, newClient];
    this.saveToStorage();
    return newClient;
  }

  updateIncident(id: string, patch: Partial<DemoIncident>): DemoIncident | null {
    const idx = this.incidents.findIndex((i) => i.id === id);
    if (idx === -1) return null;
    this.incidents[idx] = { ...this.incidents[idx], ...patch };
    this.saveToStorage();
    return this.incidents[idx];
  }
}

export const demoStore = new DemoStore();
