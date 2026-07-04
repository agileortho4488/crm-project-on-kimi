export interface Contact {
  id: number;
  name: string;
  type: 'doctor' | 'hospital' | 'clinic' | 'distributor' | 'corporate';
  specialty: string | null;
  designation: string | null;
  hospital: string | null;
  phone: string | null;
  phone2: string | null;
  email: string | null;
  whatsapp: string | null;
  address: string | null;
  district: string | null;
  division: string | null;
  status: 'active' | 'inactive' | 'prospect' | 'blacklisted';
  notes: string | null;
  lastContact: Date | null;
  nextFollowUp: Date | null;
  source: string | null;
  sourceUrl: string | null;
  enrichmentData: any;
  tags: string[];
  isVerified: boolean;
  createdAt: Date;
  updatedAt: Date;
}

export interface Lead {
  id: number;
  title: string;
  contactId: number | null;
  division: string | null;
  productInterest: string[];
  stage: 'new' | 'qualified' | 'proposal' | 'negotiation' | 'closed_won' | 'closed_lost';
  value: number;
  expectedCloseDate: Date | null;
  actualCloseDate: Date | null;
  source: string | null;
  assignedTo: string | null;
  priority: 'low' | 'medium' | 'high' | 'urgent';
  notes: string | null;
  createdAt: Date;
  updatedAt: Date;
}

export interface Activity {
  id: number;
  type: 'call' | 'visit' | 'meeting' | 'email' | 'whatsapp' | 'demo' | 'follow_up' | 'order' | 'note';
  contactId: number | null;
  leadId: number | null;
  description: string;
  date: Date;
  duration: number | null;
  outcome: string | null;
  nextAction: string | null;
  followUpDate: Date | null;
  createdBy: string | null;
  createdAt: Date;
}

export interface Task {
  id: number;
  title: string;
  description: string | null;
  assignedTo: string | null;
  dueDate: Date | null;
  priority: 'low' | 'medium' | 'high' | 'urgent';
  status: 'pending' | 'in_progress' | 'completed' | 'overdue';
  relatedType: string | null;
  relatedId: number | null;
  relatedName: string | null;
  createdAt: Date;
}

export interface Product {
  id: number;
  name: string;
  code: string | null;
  division: string | null;
  category: string | null;
  description: string | null;
  specifications: string | null;
  indications: string[];
  price: number;
  status: 'active' | 'discontinued' | 'coming_soon';
  createdAt: Date;
}

export type AppPage = 'dashboard' | 'contacts' | 'leads' | 'activities' | 'tasks' | 'products' | 'imports' | 'scraping' | 'campaigns' | 'analytics';

export const districts = [
  'Adilabad', 'Bhadradri Kothagudem', 'Hyderabad', 'Jagtial', 'Jangaon',
  'Jayashankar Bhupalpally', 'Jogulamba Gadwal', 'Kamareddy', 'Karimnagar', 'Khammam',
  'Komaram Bheem Asifabad', 'Mahabubabad', 'Mahabubnagar', 'Mancherial', 'Medak',
  'Medchal-Malkajgiri', 'Mulugu', 'Nagarkurnool', 'Nalgonda', 'Narayanpet',
  'Nirmal', 'Nizamabad', 'Peddapalli', 'Rajanna Sircilla', 'Rangareddy',
  'Sangareddy', 'Siddipet', 'Suryapet', 'Vikarabad', 'Wanaparthy',
  'Warangal Rural', 'Warangal Urban', 'Yadadri Bhuvanagiri'
];

export const divisionNames = [
  'Trauma & Fracture', 'Arthroplasty', 'Cardiovascular', 'Endo-Surgery',
  'Neuro & Spine', 'Gynecology', 'Diagnostics', 'Consumables'
];

export const specialties = [
  'Orthopedic Surgery', 'Cardiothoracic Surgery', 'Trauma Surgery', 'Obstetrics & Gynecology',
  'Neurosurgery', 'Endoscopic Surgery', 'Cardiology', 'Joint Replacement',
  'Interventional Cardiology', 'Spine Surgery', 'General Surgery', 'Pediatric Surgery',
  'Urology', 'ENT', 'Ophthalmology', 'Gastroenterology', 'Nephrology',
  'Pulmonology', 'Rheumatology', 'Oncology', 'Dental Surgery', 'Plastic Surgery',
  'Multi-Specialty', 'Medical Devices'
];
