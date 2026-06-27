/**
 * One-off (idempotent) seed: import the DUSA club directory as partner LEADS.
 *
 *   npx tsx scripts/seed-partner-leads.ts          # dry run (prints plan)
 *   npx tsx scripts/seed-partner-leads.ts --commit  # actually insert
 *
 * Source: https://www.dusa.org.au/clubs (scraped 2026-06-24). Each club becomes
 * a `partner` row with status="lead", internal-only (show_on_website=false).
 * `website` holds the club's DUSA directory page (its canonical link). DSEC's
 * own listing and one duplicate (Deakin Runners Club) were removed at scrape.
 *
 * Idempotent: skips any club whose name OR email already exists on a
 * non-archived partner, so re-running never double-inserts. Requires the
 * partner contact/socials/status columns (Alembic e3a7c5f1b9d4) to be live.
 */
import { config } from "dotenv";

config({ path: ".env.local" });

type Club = {
  name: string;
  website: string;
  email: string;
  instagram: string | null;
  linkedin: string | null;
  facebook: string | null;
};

const CLUBS: Club[] = [
  {
    "name": "PLANETUNI Geelong",
    "website": "https://www.dusa.org.au/clubs/planetuni-geelong",
    "email": "deakin.geelong@planetuni.com.au",
    "instagram": "https://www.instagram.com/planetunigeelong",
    "linkedin": null,
    "facebook": null
  },
  {
    "name": "Deakin Geelong Women's Collective",
    "website": "https://www.dusa.org.au/clubs/deakin-geelong-womens-collective-2",
    "email": "dgwomenscollective@gmail.com",
    "instagram": "https://www.instagram.com/dgwomenscollective",
    "linkedin": null,
    "facebook": null
  },
  {
    "name": "Deakin Design and Innovation Club",
    "website": "https://www.dusa.org.au/clubs/deakin-design-and-innovation-club",
    "email": "deakindesigninnovationclub@gmail.com",
    "instagram": "https://www.instagram.com/deakindesigninnovationclub",
    "linkedin": "https://www.linkedin.com/company/deakin-design-innovation-club",
    "facebook": null
  },
  {
    "name": "Filipino Young Professionals Deakin",
    "website": "https://www.dusa.org.au/clubs/filipino-young-professionals-deakin",
    "email": "FYPDeakin@outlook.com",
    "instagram": "https://www.instagram.com/_fypd_",
    "linkedin": null,
    "facebook": null
  },
  {
    "name": "Deakin Nursing Students' Society",
    "website": "https://www.dusa.org.au/clubs/deakin-nursing-students-society",
    "email": "dnss.deakin@gmail.com",
    "instagram": "https://www.instagram.com/deakinnursingstudents_society",
    "linkedin": null,
    "facebook": null
  },
  {
    "name": "Deakin University Pickleball Club",
    "website": "https://www.dusa.org.au/clubs/deakin-university-pickleball-club",
    "email": "deakin.dupc@gmail.com",
    "instagram": "https://www.instagram.com/dupc.deakin",
    "linkedin": null,
    "facebook": null
  },
  {
    "name": "Deakin Lacrosse Club",
    "website": "https://www.dusa.org.au/clubs/deakin-lacrosse-club",
    "email": "deakinlacrosse@gmail.com",
    "instagram": "https://www.instagram.com/deakinlacrosseclub",
    "linkedin": null,
    "facebook": null
  },
  {
    "name": "Deakin University Filipino Collective",
    "website": "https://www.dusa.org.au/clubs/deakin-university-filipino-collective",
    "email": "deakinunifilipinocollective@gmail.com",
    "instagram": "https://www.instagram.com/deakinfilipinocollective",
    "linkedin": null,
    "facebook": null
  },
  {
    "name": "Deakin University Cycling club",
    "website": "https://www.dusa.org.au/clubs/deakin-university-cycling-club",
    "email": "deakincyclingclub@gmail.com",
    "instagram": "https://www.instagram.com/deakinuniversity.cyclingclub",
    "linkedin": null,
    "facebook": null
  },
  {
    "name": "Deakin Tamil Students Association (DTSA)",
    "website": "https://www.dusa.org.au/clubs/deakin-tamil-students-association",
    "email": "deakintamilstudentsassociation@gmail.com",
    "instagram": "https://www.instagram.com/dtsa_burwood",
    "linkedin": null,
    "facebook": null
  },
  {
    "name": "Deakin Students Criminology Society Burwood (DSCSB)",
    "website": "https://www.dusa.org.au/clubs/dscsb",
    "email": "dscrimsocietyburwood@gmail.com",
    "instagram": "https://www.instagram.com/deakinscsburwood",
    "linkedin": null,
    "facebook": null
  },
  {
    "name": "Deakin Soccer Club",
    "website": "https://www.dusa.org.au/clubs/deakin-soccer-club",
    "email": "deakinsoccerclub26@outlook.com",
    "instagram": "https://www.instagram.com/deakin_soccer_club",
    "linkedin": null,
    "facebook": null
  },
  {
    "name": "Deakin Mature Age Student Association (DMASA)",
    "website": "https://www.dusa.org.au/clubs/deakin-mature-age-student-association",
    "email": "dusa.mature.age@gmail.com",
    "instagram": "https://www.instagram.com/dusa.mature.age",
    "linkedin": null,
    "facebook": null
  },
  {
    "name": "Deakin Innovation and Startup Club (DISC)",
    "website": "https://www.dusa.org.au/clubs/deakin-innovation-and-startup-club",
    "email": "deakininnovationandstartupclub@gmail.com",
    "instagram": "https://www.instagram.com/this.is.disc",
    "linkedin": null,
    "facebook": null
  },
  {
    "name": "Deakin Indonesian Association (DIA)",
    "website": "https://www.dusa.org.au/clubs/deakin-indonesian-association",
    "email": "deakin.indo@gmail.com",
    "instagram": "https://www.instagram.com/dia.deakin",
    "linkedin": null,
    "facebook": null
  },
  {
    "name": "Deakin Cambodian Club (DCC)",
    "website": "https://www.dusa.org.au/clubs/deakin-cambodian-club",
    "email": "dcambodianstudentassociation@gmail.com",
    "instagram": "https://www.instagram.com/dcc.deakin",
    "linkedin": null,
    "facebook": null
  },
  {
    "name": "Deakin Botany Club (DBC)",
    "website": "https://www.dusa.org.au/clubs/deakin-botany-club",
    "email": "deakinbotanyclub@gmail.com",
    "instagram": "https://www.instagram.com/deakinbotanyclub",
    "linkedin": null,
    "facebook": "https://www.facebook.com/share/1C1wSQH8rY"
  },
  {
    "name": "Deakin Basketball Association (DBA)",
    "website": "https://www.dusa.org.au/clubs/deakin-basketball-association",
    "email": "deakinbasketballassociation@gmail.com",
    "instagram": "https://www.instagram.com/team.dba_",
    "linkedin": null,
    "facebook": null
  },
  {
    "name": "Deakin Afghan Society (DAS)",
    "website": "https://www.dusa.org.au/clubs/deakin-afghan-society",
    "email": "deakinafghansociety6@gmail.com",
    "instagram": "https://www.instagram.com/deakinafghansociety",
    "linkedin": null,
    "facebook": null
  },
  {
    "name": "Deakin Women's Collective (DBWC)",
    "website": "https://www.dusa.org.au/clubs/deakin-womens-collective",
    "email": "deakinburwoodwomenscollective@gmail.com",
    "instagram": "https://www.instagram.com/dbwomenscollective",
    "linkedin": null,
    "facebook": null
  },
  {
    "name": "Deakin Consulting Association (BW DCA)",
    "website": "https://www.dusa.org.au/clubs/deakin-consulting-association",
    "email": "deakinconsultingassociation@gmail.com",
    "instagram": "https://www.instagram.com/deakinconsultingassociation",
    "linkedin": null,
    "facebook": null
  },
  {
    "name": "Geelong Social Club (GSC)",
    "website": "https://www.dusa.org.au/clubs/geelong-social-club-gsc",
    "email": "geelongsocialclub@gmail.com",
    "instagram": null,
    "linkedin": null,
    "facebook": null
  },
  {
    "name": "Students for Palestine (SFP)",
    "website": "https://www.dusa.org.au/clubs/students-for-palestine-burwood-sfp",
    "email": "deakinstudentsforpalestine@gmail.com",
    "instagram": "https://www.instagram.com/deakinstudentsforpalestine",
    "linkedin": null,
    "facebook": null
  },
  {
    "name": "Deakin Property Real Estate Society (DPRES)",
    "website": "https://www.dusa.org.au/clubs/deakin-property-real-estate-society-burwood-dpres",
    "email": "deakinpropertyrealestate@gmail.com",
    "instagram": "https://www.instagram.com/deakinpropertysociety",
    "linkedin": null,
    "facebook": null
  },
  {
    "name": "Warrnambool Medical Students Association (MED)",
    "website": "https://www.dusa.org.au/clubs/warrnambool-medical-students-association-warrnambool-med",
    "email": "warrnamboolmsa@gmail.com",
    "instagram": "https://www.instagram.com/warrnamboolmedicalstudent",
    "linkedin": null,
    "facebook": null
  },
  {
    "name": "Deakin Association of Psychology Students (DAPS)",
    "website": "https://www.dusa.org.au/clubs/deakin-association-of-psychology-students-burwood-daps",
    "email": "deakinassoc.psych@gmail.com",
    "instagram": "https://www.instagram.com/deakinpsychstudents_assoc",
    "linkedin": null,
    "facebook": null
  },
  {
    "name": "Deakin Data Science Club (DDSC)",
    "website": "https://www.dusa.org.au/clubs/deakin-data-science-club-burwood-ddsc",
    "email": "deakindatascienceclub@gmail.com",
    "instagram": null,
    "linkedin": null,
    "facebook": "https://www.facebook.com/deakindsc"
  },
  {
    "name": "Geelong Students Acting Club (GSAC)",
    "website": "https://www.dusa.org.au/clubs/geelong-students-acting-club-geelong-gsac",
    "email": "geelongstudentsactingclub@gmail.com",
    "instagram": "https://www.instagram.com/deakingsac",
    "linkedin": null,
    "facebook": null
  },
  {
    "name": "Deakin Occupational Therapist Student Association (OTSA)",
    "website": "https://www.dusa.org.au/clubs/deakin-occupational-therapist-student-association-geelong-otsa",
    "email": "dotsadeakin@outlook.com",
    "instagram": "https://www.instagram.com/dotsa_deakin",
    "linkedin": null,
    "facebook": null
  },
  {
    "name": "Deakin Anaesthetics Society (DAS)",
    "website": "https://www.dusa.org.au/clubs/deakin-anaesthetics-society-geelong-das",
    "email": "dasdeakin@gmail.com",
    "instagram": "https://www.instagram.com/das.deakin",
    "linkedin": null,
    "facebook": null
  },
  {
    "name": "Deakin University Bangladeshi Club (DBC)",
    "website": "https://www.dusa.org.au/clubs/deakin-university-bangladeshi-club-burwood-dbc",
    "email": "deakinbangladeshiclub@gmail.com",
    "instagram": "https://www.instagram.com/deakinbangladeshis",
    "linkedin": null,
    "facebook": null
  },
  {
    "name": "Deakin Boardriders Club (BRC)",
    "website": "https://www.dusa.org.au/clubs/deakin-boardriders-club-burwood-brc",
    "email": "deakinboardriderclub@gmail.com",
    "instagram": "https://www.instagram.com/deakinboardridersclub",
    "linkedin": null,
    "facebook": null
  },
  {
    "name": "Deakin Women in Stem Society (WSS)",
    "website": "https://www.dusa.org.au/clubs/deakin-women-in-stem-society-burwood-wss",
    "email": "deakinwomeninstemsociety@gmail.com",
    "instagram": "https://www.instagram.com/deakin.womeninstem",
    "linkedin": null,
    "facebook": null
  },
  {
    "name": "Deakin Volunteering Hub (DVH)",
    "website": "https://www.dusa.org.au/clubs/deakin-volunteering-hub-burwood-dvh",
    "email": "deakinvolunteeringhub@gmail.com",
    "instagram": "https://www.instagram.com/deakinvolunteeringhub",
    "linkedin": null,
    "facebook": null
  },
  {
    "name": "Deakin University Cybersecurity Association (DUCA)",
    "website": "https://www.dusa.org.au/clubs/deakin-university-cybersecurity-association-burwood-duca",
    "email": "info@duca.au",
    "instagram": "https://www.instagram.com/duca.club",
    "linkedin": null,
    "facebook": "https://www.facebook.com/deakinduca"
  },
  {
    "name": "Deakin Malaysian Association (DMA)",
    "website": "https://www.dusa.org.au/clubs/deakin-malaysian-association-burwood-dma",
    "email": "deakinmalaysianassociation@gmail.com",
    "instagram": "https://www.instagram.com/dma_deakin",
    "linkedin": "https://www.linkedin.com/company/deakinmalaysianassociation/about",
    "facebook": "https://www.facebook.com/profile.php"
  },
  {
    "name": "Deakin Sikh Society (SIKH)",
    "website": "https://www.dusa.org.au/clubs/deakin-sikh-society-burwood-sikh",
    "email": "deakinsikhs@gmail.com",
    "instagram": "https://www.instagram.com/deakinsikhsociety",
    "linkedin": null,
    "facebook": "https://www.facebook.com/profile.php"
  },
  {
    "name": "Burwood Engineering Society (BES)",
    "website": "https://www.dusa.org.au/clubs/burwood-engineering-society-burwood-bes",
    "email": "burwoodengineeringsociety@gmail.com",
    "instagram": "https://www.instagram.com/burwoodengineeringsociety",
    "linkedin": null,
    "facebook": "https://www.facebook.com/profile.php"
  },
  {
    "name": "BuildHub Deakin (BHD)",
    "website": "https://www.dusa.org.au/clubs/buildhub-deakin-geelong-bhd",
    "email": "buildhub@deakin.edu.au",
    "instagram": "https://www.instagram.com/buildhub.deakin",
    "linkedin": null,
    "facebook": null
  },
  {
    "name": "Deakin University Australasian Union of Jewish Students (AUJS)",
    "website": "https://www.dusa.org.au/clubs/jewish-students-society",
    "email": "deakinaujs1@gmail.com",
    "instagram": "https://www.instagram.com/aujs_deakin",
    "linkedin": null,
    "facebook": "https://www.facebook.com/AUJSDeakin"
  },
  {
    "name": "Deakin MotorSport (DMS)",
    "website": "https://www.dusa.org.au/clubs/deakin-motorsport",
    "email": "deakinmotorsport@gmail.com",
    "instagram": "https://www.instagram.com/deakinmotorsport",
    "linkedin": null,
    "facebook": "https://www.facebook.com/deakinmotorsport"
  },
  {
    "name": "Geelong Disability Collective",
    "website": "https://www.dusa.org.au/clubs/deakin-geelong-disability-neurodivergency-association",
    "email": "geelongdisco@gmail.com",
    "instagram": "https://www.instagram.com/deakindnageelong",
    "linkedin": null,
    "facebook": "https://www.facebook.com/deakindnageelong"
  },
  {
    "name": "Geelong Labor Club (GLC)",
    "website": "https://www.dusa.org.au/clubs/geelong-labor-club",
    "email": "geelonglaborclub@gmail.com",
    "instagram": "https://www.instagram.com/deakinlaborclub",
    "linkedin": null,
    "facebook": "https://www.facebook.com/LaborClubDeakin"
  },
  {
    "name": "Deakin Coastcarers Club (DCC)",
    "website": "https://www.dusa.org.au/clubs/deakin-coastcarers",
    "email": "deakincoastcarers@outlook.com",
    "instagram": "https://www.instagram.com/deakin.coastcarers",
    "linkedin": null,
    "facebook": "https://www.facebook.com/profile.php"
  },
  {
    "name": "Deakin University ASEAN (DUASEAN)",
    "website": "https://www.dusa.org.au/clubs/deakin-university-asean",
    "email": "dusa-asean-club@deakin.edu.au",
    "instagram": "https://www.instagram.com/du_asean",
    "linkedin": "https://www.linkedin.com/in/deakin-university-association-of-south-east-asian-nations-duasean-9210012b0",
    "facebook": "https://www.facebook.com/deakinuniversityasean"
  },
  {
    "name": "Deakin Vietnamese International Students of Geelong (DVISG)",
    "website": "https://www.dusa.org.au/clubs/deakin-vietnamese-international-students-of-geelong-dvisg",
    "email": "dvisg.geelong@gmail.com",
    "instagram": "https://www.instagram.com/_dvisg",
    "linkedin": null,
    "facebook": "https://www.facebook.com/people/DVISG-Deakin-Vietnamese-International-Students-of-Geelong/61555140059795"
  },
  {
    "name": "Deakin Competitive Robotics (DCR)",
    "website": "https://www.dusa.org.au/clubs/deakin-competitive-robotics",
    "email": "deakincompetitiverobotics@gmail.com",
    "instagram": null,
    "linkedin": null,
    "facebook": "https://www.facebook.com/people/Deakin-Competitive-Robotics/61555006456796"
  },
  {
    "name": "Deakin African Student Society (DASS)",
    "website": "https://www.dusa.org.au/clubs/deakin-african-student-society-dass",
    "email": "dusa-african-student-society@deakin.edu.au",
    "instagram": "https://www.instagram.com/deakinafrica",
    "linkedin": null,
    "facebook": null
  },
  {
    "name": "Ecological Collective (DEC)",
    "website": "https://www.dusa.org.au/clubs/deakin-ecological-collective",
    "email": "ecologicalcoll@gmail.com",
    "instagram": "https://www.instagram.com/dec.geelong",
    "linkedin": null,
    "facebook": "https://www.facebook.com/deakinecologicalcollectivegeelong"
  },
  {
    "name": "Deakin K-Pop Society (DKS)",
    "website": "https://www.dusa.org.au/clubs/deakin-k-pop-society-dks",
    "email": "dusa-k-pop-society@deakin.edu.au",
    "instagram": "https://www.instagram.com/deakinkpopsociety",
    "linkedin": null,
    "facebook": null
  },
  {
    "name": "Deakin Vietnamese International Students and Extensions (DeVISE)",
    "website": "https://www.dusa.org.au/clubs/deakin-vietnamese-international-students-and-extensions-devise",
    "email": "dusa-vietnamese-international-students@deakin.edu.au",
    "instagram": "https://www.instagram.com/deakin.devise",
    "linkedin": null,
    "facebook": "https://www.facebook.com/devisedeakin"
  },
  {
    "name": "Deakin International Students Association (DISA)",
    "website": "https://www.dusa.org.au/clubs/deakin-international-community-embrace-dice",
    "email": "dusainternational@deakin.edu.au",
    "instagram": "https://www.instagram.com/deakininternationalassociation",
    "linkedin": null,
    "facebook": null
  },
  {
    "name": "Deakin University Indian Club (DUICG)",
    "website": "https://www.dusa.org.au/clubs/deakin-university-indian-club-geelong-duicg",
    "email": "Duicg.geelong@gmail.com",
    "instagram": "https://www.instagram.com/duic.geelong",
    "linkedin": null,
    "facebook": "https://www.facebook.com/duicg1"
  },
  {
    "name": "Deakin Physician Interest Group (GE DPIG)",
    "website": "https://www.dusa.org.au/clubs/deakin-physician-interest-group",
    "email": "dpig@deakin.edu.au",
    "instagram": null,
    "linkedin": null,
    "facebook": "https://www.facebook.com/profile.php"
  },
  {
    "name": "Deakin Pathology and Radiology Association (DPRA)",
    "website": "https://www.dusa.org.au/clubs/deakin-pathology-and-radiology-association-dpra",
    "email": "secretary.dpra@gmail.com",
    "instagram": "https://www.instagram.com/dpra.deakin",
    "linkedin": null,
    "facebook": "https://www.facebook.com/dpra.deakin"
  },
  {
    "name": "Society of the Deakin Arts (SODA)",
    "website": "https://www.dusa.org.au/clubs/society-of-the-deakin-arts",
    "email": "dusa-arts-society@deakin.edu.au",
    "instagram": "https://www.instagram.com/socdeakinarts",
    "linkedin": null,
    "facebook": "https://www.facebook.com/groups/838041083937766"
  },
  {
    "name": "Deakin Dancers United (DDU)",
    "website": "https://www.dusa.org.au/clubs/deakin-dancers-united",
    "email": "dusa-dancers-united@deakin.edu.au",
    "instagram": "https://www.instagram.com/deakin_dancers_united",
    "linkedin": null,
    "facebook": null
  },
  {
    "name": "Deakin Runners Club (DRC)",
    "website": "https://www.dusa.org.au/clubs/deakin-runners",
    "email": "deakinrunnersclub@gmail.com",
    "instagram": "https://www.instagram.com/deakinrunnersclub",
    "linkedin": null,
    "facebook": "https://www.facebook.com/profile.php"
  },
  {
    "name": "Deakin Disability & Neurodivergence Association (DDNA)",
    "website": "https://www.dusa.org.au/clubs/deakin-disability-neurodivergency-association",
    "email": "Deakindna@gmail.com",
    "instagram": "https://www.instagram.com/deakindna",
    "linkedin": null,
    "facebook": null
  },
  {
    "name": "Deakin University Pakistani Student Association (DUPSA)",
    "website": "https://www.dusa.org.au/clubs/deakin-university-pakistani-student-association-dupsa",
    "email": "dusa.pakistanisociety@gmail.com",
    "instagram": "https://www.instagram.com/deakinpakistanis",
    "linkedin": null,
    "facebook": "https://www.facebook.com/profile.php"
  },
  {
    "name": "Deakin Social Club (DSC)",
    "website": "https://www.dusa.org.au/clubs/deakin-social-club-dsc",
    "email": "dusa-deakin-social-club@deakin.edu.au",
    "instagram": "https://www.instagram.com/deakinsocialclub23",
    "linkedin": null,
    "facebook": null
  },
  {
    "name": "Deakin Business and Analytics Society (DBAS)",
    "website": "https://www.dusa.org.au/clubs/deakin-business-and-analytics-society-dbas",
    "email": "dusa-bus-analytics-society@deakin.edu.au",
    "instagram": "https://www.instagram.com/deakinbas",
    "linkedin": null,
    "facebook": "https://www.facebook.com/DeakinBAS"
  },
  {
    "name": "Deakin University Indian Club (DUICB)",
    "website": "https://www.dusa.org.au/clubs/deakin-university-indian-club-burwood-duicb",
    "email": "deakinindianclub@gmail.com",
    "instagram": "https://www.instagram.com/deakinindianclub",
    "linkedin": null,
    "facebook": "https://www.facebook.com/Deakin-Indian-Club-105927032164317"
  },
  {
    "name": "Deakin Table Tennis Club (DTTC)",
    "website": "https://www.dusa.org.au/clubs/deakin-table-tennis-club-dttc-2",
    "email": "deakintabletennis@gmail.com",
    "instagram": "https://www.instagram.com/deakintabletennis",
    "linkedin": null,
    "facebook": null
  },
  {
    "name": "Deakin Chess Club (DCC)",
    "website": "https://www.dusa.org.au/clubs/deakin-chess-club",
    "email": "dusa-chess-club@deakin.edu.au",
    "instagram": "https://www.instagram.com/deakinchessclub",
    "linkedin": null,
    "facebook": "https://www.facebook.com/groups/deakinchessclub"
  },
  {
    "name": "Global Village Project (GVP)",
    "website": "https://www.dusa.org.au/clubs/global-village-project",
    "email": "contact.globalvillageproject@gmail.com",
    "instagram": "https://www.instagram.com/globalvillageprojectau",
    "linkedin": null,
    "facebook": "https://www.facebook.com/globalvillageprojectau"
  },
  {
    "name": "Deakin University Volleyball Club (DUVC)",
    "website": "https://www.dusa.org.au/clubs/deakin-university-volleyball-club-duvc",
    "email": "dusa-volleyball-burwood@deakin.edu.au",
    "instagram": "https://www.instagram.com/deakinvolleyballclub",
    "linkedin": null,
    "facebook": "https://www.facebook.com/groups/1178387732678978"
  },
  {
    "name": "Geelong Christian Union (CU)",
    "website": "https://www.dusa.org.au/clubs/geelong-christian-union",
    "email": "geelong.cu@gmail.com",
    "instagram": "https://www.instagram.com/geelongcu",
    "linkedin": null,
    "facebook": "https://www.facebook.com/GeelongChristianUnion"
  },
  {
    "name": "Deakin University Badminton Association (DUBA)",
    "website": "https://www.dusa.org.au/clubs/deakinbadminton",
    "email": "deakinunibaddy@gmail.com",
    "instagram": "https://www.instagram.com/deakinunibaddy",
    "linkedin": null,
    "facebook": "https://www.facebook.com/groups/235915944808857"
  },
  {
    "name": "Deakin University Paediatrics Society (DUPS)",
    "website": "https://www.dusa.org.au/clubs/deakin-university-paediatrics-society-ge-dups",
    "email": "deakin.paediatrics@gmail.com",
    "instagram": null,
    "linkedin": null,
    "facebook": "https://www.facebook.com/deakinpaediatrics"
  },
  {
    "name": "Deakin Students Criminology Society (DSCS)",
    "website": "https://www.dusa.org.au/clubs/deakin-students-criminology-society-ge-crim",
    "email": "DSCSGeelong@gmail.com",
    "instagram": "https://www.instagram.com/deakinscs",
    "linkedin": null,
    "facebook": "https://www.facebook.com/DeakinSCS"
  },
  {
    "name": "Deakin Medical Research Student Association (DMRSA)",
    "website": "https://www.dusa.org.au/clubs/deakin-medical-research-student-association",
    "email": "mrsadeakin@outlook.com",
    "instagram": "https://www.instagram.com/deakinmrsa",
    "linkedin": null,
    "facebook": "https://www.facebook.com/deakinMRSA"
  },
  {
    "name": "Enviro Club (ENVIRO)",
    "website": "https://www.dusa.org.au/clubs/enviro-club-warrnambool",
    "email": "envirowarrnambool@outlook.com",
    "instagram": "https://www.instagram.com/enviro.club_warrnambool",
    "linkedin": null,
    "facebook": "https://www.facebook.com/EnviroWarrnambool"
  },
  {
    "name": "Deakin Music Club (DMC)",
    "website": "https://www.dusa.org.au/clubs/deakin-music-club",
    "email": "dusa-deakin-music@deakin.edu.au",
    "instagram": "https://www.instagram.com/deakinmusic_burwood",
    "linkedin": null,
    "facebook": null
  },
  {
    "name": "Deakin Ultimate Frisbee Club (ULTIMATE)",
    "website": "https://www.dusa.org.au/clubs/deakin-ultimate-frisbee-club-ultimate",
    "email": "dusa-ultimate-frisbee@deakin.edu.au",
    "instagram": "https://www.instagram.com/deakinultimate",
    "linkedin": null,
    "facebook": "https://www.facebook.com/deakinultimate"
  },
  {
    "name": "Deakin Pride; Queer Society (PRIDE)",
    "website": "https://www.dusa.org.au/clubs/deakin-pride-pride",
    "email": "dusa-pride-b@deakin.edu.au",
    "instagram": "https://www.instagram.com/deakinpride",
    "linkedin": null,
    "facebook": "https://www.facebook.com/DeakinPride"
  },
  {
    "name": "PLANETUNI Deakin",
    "website": "https://www.dusa.org.au/clubs/planetuni_burwood",
    "email": "dusa-planetuni-burwood@deakin.edu.au",
    "instagram": null,
    "linkedin": null,
    "facebook": "https://www.facebook.com/groups/planetunideakinburwood"
  },
  {
    "name": "Japanese-Australian Social Society (JASS)",
    "website": "https://www.dusa.org.au/clubs/japanese-australian-social-society-jass",
    "email": "Jassdeakin@gmail.com",
    "instagram": "https://www.instagram.com/jassdeakin",
    "linkedin": null,
    "facebook": "https://www.facebook.com/JASSofdeakin"
  },
  {
    "name": "Islamic Society of Deakin University (ISDU)",
    "website": "https://www.dusa.org.au/clubs/islamic-society-of-deakin-university-isdu",
    "email": "dusa-isdu-melb@deakin.edu.au",
    "instagram": "https://www.instagram.com/deakinmuslims",
    "linkedin": null,
    "facebook": "https://www.facebook.com/isdub"
  },
  {
    "name": "Deakin University Food and Nutrition Society (FANS)",
    "website": "https://www.dusa.org.au/clubs/food-and-nutrition-society-fans",
    "email": "dusa-fans-bur@deakin.edu.au",
    "instagram": "https://www.instagram.com/fansdeakin",
    "linkedin": null,
    "facebook": "https://www.facebook.com/fansdeakin"
  },
  {
    "name": "Deakin Enviro Club (ENVIRO)",
    "website": "https://www.dusa.org.au/clubs/deakin-enviro-club-enviro",
    "email": "dusa-enviro-club@deakin.edu.au",
    "instagram": "https://www.instagram.com/deakinenviroclub",
    "linkedin": null,
    "facebook": "https://www.facebook.com/deakin.enviro.7"
  },
  {
    "name": "Deakin Visual Arts Society (DVAS)",
    "website": "https://www.dusa.org.au/clubs/deakin-visual-arts-society-dvas",
    "email": "dusa-visual-arts-club@deakin.edu.au",
    "instagram": "https://www.instagram.com/deakinvisualart",
    "linkedin": null,
    "facebook": "https://www.facebook.com/deakinvisualartsociety"
  },
  {
    "name": "Deakin University Sport Society (DUSS)",
    "website": "https://www.dusa.org.au/clubs/deakin-university-sport-society-duss",
    "email": "dusa-unisport-studies@deakin.edu.au",
    "instagram": "https://www.instagram.com/deakinsportsociety",
    "linkedin": "https://www.linkedin.com/company/deakinuniversitysportsociety",
    "facebook": null
  },
  {
    "name": "Deakin University Sri Lankan Association (DUSLA)",
    "website": "https://www.dusa.org.au/clubs/deakin-university-sri-lankan-association-dusla",
    "email": "dusa-sri-lankan-association@deakin.edu.au",
    "instagram": "https://www.instagram.com/duslamelbourne",
    "linkedin": null,
    "facebook": "https://www.facebook.com/duslamelbourne"
  },
  {
    "name": "Deakin University Snow Club (DUSC)",
    "website": "https://www.dusa.org.au/clubs/deakin-university-snow-club-dusc",
    "email": "dusa-snow-club@deakin.edu.au",
    "instagram": "https://www.instagram.com/deakinsnowclub",
    "linkedin": null,
    "facebook": "https://www.facebook.com/DeakinUniSnowClub"
  },
  {
    "name": "Deakin Netball Club (DNC)",
    "website": "https://www.dusa.org.au/clubs/deakin-netball-club-dnc",
    "email": "dusa-deakin-netball-club@deakin.edu.au",
    "instagram": "https://www.instagram.com/deakinnetballclub",
    "linkedin": null,
    "facebook": null
  },
  {
    "name": "Deakin University Liberal Club (DULC)",
    "website": "https://www.dusa.org.au/clubs/deakin-university-liberal-club-dulc",
    "email": "dusa-liberal-club@deakin.edu.au",
    "instagram": null,
    "linkedin": null,
    "facebook": "https://www.facebook.com/deakinlibs"
  },
  {
    "name": "Deakin University Greek Society (DUGS)",
    "website": "https://www.dusa.org.au/clubs/deakin-university-greek-society-dugs",
    "email": "dusa-greek-club@deakin.edu.au",
    "instagram": "https://www.instagram.com/dugs.victoria",
    "linkedin": null,
    "facebook": "https://www.facebook.com/dugs.victoria"
  },
  {
    "name": "Deakin Film Society (DFS)",
    "website": "https://www.dusa.org.au/clubs/deakin-film",
    "email": "dusa-deakin-film-society@deakin.edu.au",
    "instagram": "https://www.instagram.com/deakinfilmsociety",
    "linkedin": null,
    "facebook": "https://www.facebook.com/DeakinFilmSociety"
  },
  {
    "name": "Deakin Tabletop Society (DTS)",
    "website": "https://www.dusa.org.au/clubs/deakin-tabletop-society-dts",
    "email": "tabletopexecteam@gmail.com",
    "instagram": "https://www.instagram.com/deakintabletopsociety",
    "linkedin": null,
    "facebook": "https://www.facebook.com/groups/DeakinTabletopSociety"
  },
  {
    "name": "Deakin Software Engineering Club (DSEC)",
    "website": "https://www.dusa.org.au/clubs/deakin-software-engineering-club-dsec",
    "email": "dusa-software-engineering-club@deakin.edu.au",
    "instagram": "https://www.instagram.com/_deakinsec",
    "linkedin": null,
    "facebook": "https://www.facebook.com/DeakinSEC"
  },
  {
    "name": "Deakin Dodgeball (DODGE)",
    "website": "https://www.dusa.org.au/clubs/deakin-dodgeball-dodge",
    "email": "dusa-dodgeball-club@deakin.edu.au",
    "instagram": null,
    "linkedin": null,
    "facebook": "https://www.facebook.com/DUDBS"
  },
  {
    "name": "Deakin Outdoors Club (DOC)",
    "website": "https://www.dusa.org.au/clubs/deakin-outdoors-club-doc",
    "email": "info@doc.org.au",
    "instagram": "https://www.instagram.com/deakin.outdoors",
    "linkedin": null,
    "facebook": null
  },
  {
    "name": "Deakin Nursing and Midwifery Society (DNMS)",
    "website": "https://www.dusa.org.au/clubs/deakin-nursing-and-midwifery-society-dnms",
    "email": "dusa-nursing-society@deakin.edu.au",
    "instagram": "https://www.instagram.com/deakinnms",
    "linkedin": null,
    "facebook": "https://www.facebook.com/deakinnms"
  },
  {
    "name": "Deakin International Affairs Society (DIAS)",
    "website": "https://www.dusa.org.au/clubs/deakin-international-affairs-society-dias",
    "email": "dusa-international-affairs-society@deakin.edu.au",
    "instagram": "https://www.instagram.com/deakininternationalaffairs",
    "linkedin": null,
    "facebook": "https://www.facebook.com/diasburwood"
  },
  {
    "name": "Deakin Esports Association (DESA)",
    "website": "https://www.dusa.org.au/clubs/deakin-esports-association",
    "email": "deakinesportassociation@gmail.com",
    "instagram": "https://www.instagram.com/deakin_esports",
    "linkedin": null,
    "facebook": "https://www.facebook.com/groups/DeakinUniversityEsports"
  },
  {
    "name": "Deakin Debating Society (DDS)",
    "website": "https://www.dusa.org.au/clubs/deakin-debating-society-dds",
    "email": "dusa-debating-b@deakin.edu.au",
    "instagram": "https://www.instagram.com/deakindebating",
    "linkedin": null,
    "facebook": "https://www.facebook.com/deakindebatingsociety"
  },
  {
    "name": "Deakin Commerce Society (DCS)",
    "website": "https://www.dusa.org.au/clubs/deakin-commerce-society-dcs",
    "email": "dusa-commerce-melb@deakin.edu.au",
    "instagram": "https://www.instagram.com/deakincommercesociety",
    "linkedin": null,
    "facebook": "https://www.facebook.com/deakincommercesociety"
  },
  {
    "name": "Deakin Chinese Student Society (DCSS)",
    "website": "https://www.dusa.org.au/clubs/chinese-student-society",
    "email": "dusa-chinese-stud-society@deakin.edu.au",
    "instagram": null,
    "linkedin": null,
    "facebook": "https://www.facebook.com/offical.deakincssa"
  },
  {
    "name": "Christian Union (CU)",
    "website": "https://www.dusa.org.au/clubs/christian-union-cu",
    "email": "dusa-christian-union-b@deakin.edu.au",
    "instagram": "https://www.instagram.com/deakincu",
    "linkedin": null,
    "facebook": "https://www.facebook.com/deakincu"
  },
  {
    "name": "Deakin Cheer and Dance (CHEER)",
    "website": "https://www.dusa.org.au/clubs/deakin-cheer-and-dance",
    "email": "dusa-cheerleading@deakin.edu.au",
    "instagram": "https://www.instagram.com/deakincheer",
    "linkedin": null,
    "facebook": "https://www.facebook.com/deakincheer"
  },
  {
    "name": "Deakin University Biomedical Society (DUBS)",
    "website": "https://www.dusa.org.au/clubs/deakin-university-biomed-society-dubs",
    "email": "dusa-du-biomed-society@deakin.edu.au",
    "instagram": "https://www.instagram.com/dubsburwood",
    "linkedin": null,
    "facebook": "https://www.facebook.com/DubsBurwood"
  },
  {
    "name": "Burwood Student Theatre Company (BUSTCO)",
    "website": "https://www.dusa.org.au/clubs/burwood-student-theatre-company-bustco",
    "email": "dusa-bustco@deakin.edu.au",
    "instagram": "https://www.instagram.com/burwoodstudenttheatrecompany",
    "linkedin": null,
    "facebook": "https://www.facebook.com/bustco"
  },
  {
    "name": "Deakin Anime Club (DAC)",
    "website": "https://www.dusa.org.au/clubs/deakin-anime-club",
    "email": "dusa-anime@deakin.edu.au",
    "instagram": "https://www.instagram.com/deakinanimeclub",
    "linkedin": null,
    "facebook": "https://www.facebook.com/DeakinAnimeClub"
  },
  {
    "name": "Deakin Labor Club (LABOR)",
    "website": "https://www.dusa.org.au/clubs/deakin-labor-club",
    "email": "youngdeakinlaborclub@gmail.com",
    "instagram": "https://www.instagram.com/deakinlaborclub",
    "linkedin": null,
    "facebook": "https://www.facebook.com/LaborClubDeakin"
  },
  {
    "name": "NOMAD - Nursing, Occupational Health, Medicine and Allied Health at Deakin (NOMAD)",
    "website": "https://www.dusa.org.au/clubs/nomad",
    "email": "secretary.nomad@gmail.com",
    "instagram": "https://www.instagram.com/nomaddeakin",
    "linkedin": null,
    "facebook": "https://www.facebook.com/DeakinNOMAD"
  },
  {
    "name": "Medical Imaging Student Association (MISA)",
    "website": "https://www.dusa.org.au/clubs/medical-imaging",
    "email": "misadeakin@gmail.com",
    "instagram": "https://www.instagram.com/misa_deakin",
    "linkedin": null,
    "facebook": "https://www.facebook.com/misadeakin"
  },
  {
    "name": "MeDUSA - Deakin Medical Students' Association (MEDUSA)",
    "website": "https://www.dusa.org.au/clubs/medusa",
    "email": "president@medusa.org.au",
    "instagram": "https://www.instagram.com/medusa.deakin",
    "linkedin": null,
    "facebook": "https://www.facebook.com/medusa.deakin"
  },
  {
    "name": "Deakin Geelong Queer Collective (DGQC)",
    "website": "https://www.dusa.org.au/clubs/queer-collective",
    "email": "deakingeelongqc@gmail.com",
    "instagram": "https://www.instagram.com/deakingeelongqc",
    "linkedin": null,
    "facebook": "https://www.facebook.com/GeelongQC"
  },
  {
    "name": "Deakin Law Students’ Society (DLSS)",
    "website": "https://www.dusa.org.au/clubs/law-students",
    "email": "secretary@dlssgeelong.com.au",
    "instagram": "https://www.instagram.com/dlssgeelong",
    "linkedin": null,
    "facebook": "https://www.facebook.com/DLSSGeelong"
  },
  {
    "name": "General Practice Students Network (GPSN)",
    "website": "https://www.dusa.org.au/clubs/general-practice",
    "email": "deakin@student.gpra.org.au",
    "instagram": null,
    "linkedin": null,
    "facebook": "https://www.facebook.com/DeakinGPSN"
  },
  {
    "name": "Emergency Medicine At Deakin (EMD)",
    "website": "https://www.dusa.org.au/clubs/emergency-medicine",
    "email": "emergencymed.deakin@gmail.com",
    "instagram": "https://www.instagram.com/emdclub",
    "linkedin": null,
    "facebook": "https://www.facebook.com/emdclub"
  },
  {
    "name": "Deakin Ducks Football Club (SOCCER)",
    "website": "https://www.dusa.org.au/clubs/soccer-club",
    "email": "jordanryanengstrom@gmail.com",
    "instagram": "https://www.instagram.com/deakinducks",
    "linkedin": null,
    "facebook": "https://www.facebook.com/DeakinSoccer"
  },
  {
    "name": "Deakin University Obstetrics and Gynaecology Society (DUOGS)",
    "website": "https://www.dusa.org.au/clubs/obstetrics-and-gynaecology",
    "email": "deakinobgyn@gmail.com",
    "instagram": "https://www.instagram.com/duogs_",
    "linkedin": null,
    "facebook": "https://www.facebook.com/DUOGSAus"
  },
  {
    "name": "Deakin University Islamic Society (DUIS)",
    "website": "https://www.dusa.org.au/clubs/islamic-society",
    "email": "duis.deakin@gmail.com",
    "instagram": "https://www.instagram.com/duisgeelong",
    "linkedin": null,
    "facebook": "https://www.facebook.com/DUISGeelong"
  },
  {
    "name": "Deakin Teddy Bear Hospital (DTBH)",
    "website": "https://www.dusa.org.au/clubs/teddy-bear-hospital",
    "email": "dtbhospital@deakin.edu.au",
    "instagram": "https://www.instagram.com/deakinteddybear",
    "linkedin": null,
    "facebook": "https://www.facebook.com/DeakinTeddyBearHospital"
  },
  {
    "name": "Deakin Optometry Student Society (DOSS)",
    "website": "https://www.dusa.org.au/clubs/optometry-society",
    "email": "deakinoptomstudentsociety@gmail.com",
    "instagram": "https://www.instagram.com/deakinoptometry",
    "linkedin": null,
    "facebook": "https://www.facebook.com/deakinoptomss"
  },
  {
    "name": "Deakin Engineering Society (DES)",
    "website": "https://www.dusa.org.au/clubs/deakin-engineering",
    "email": "des@deakin.edu.au",
    "instagram": null,
    "linkedin": null,
    "facebook": "https://www.facebook.com/DeakinEngineeringSociety"
  },
  {
    "name": "Deakin University Computer Society (DUCS)",
    "website": "https://www.dusa.org.au/clubs/computer-society",
    "email": "deakincomputersociety@gmail.com",
    "instagram": "https://www.instagram.com/deakincomputersociety",
    "linkedin": null,
    "facebook": "https://www.facebook.com/deakincomputersociety"
  },
  {
    "name": "Deakin University Biomedical Society (DUBS)",
    "website": "https://www.dusa.org.au/clubs/biomedical-society",
    "email": "dubsgeelong@gmail.com",
    "instagram": "https://www.instagram.com/dubsgeelong",
    "linkedin": "https://www.linkedin.com/company/deakin-university-biomedical-society-geelong",
    "facebook": "https://www.facebook.com/DUBSGeelong"
  }
];

async function main() {
  const commit = process.argv.includes("--commit");
  const { Pool } = await import("pg");
  const url = new URL(process.env.DATABASE_URL ?? "");
  const needsSsl = url.searchParams.get("sslmode") === "require";
  url.searchParams.delete("sslmode");
  const pool = new Pool({
    connectionString: url.toString(),
    ssl: needsSsl ? { rejectUnauthorized: true } : undefined,
  });

  let inserted = 0;
  let skipped = 0;
  try {
    // Guard: make sure the new columns exist before we try to write them.
    const { rows: cols } = await pool.query(
      `SELECT column_name FROM information_schema.columns WHERE table_name = 'partner'`,
    );
    const have = new Set(cols.map((c: { column_name: string }) => c.column_name));
    for (const need of ["email", "instagram", "linkedin", "facebook", "status"]) {
      if (!have.has(need)) {
        throw new Error(
          `partner.${need} column missing — apply migration e3a7c5f1b9d4 first.`,
        );
      }
    }

    for (const c of CLUBS) {
      // Match on email only — it's the unique key. Matching on name too would
      // wrongly collapse legitimately distinct same-named campus clubs (e.g.
      // the Burwood vs Geelong "Deakin University Biomedical Society (DUBS)").
      const { rows: dupe } = await pool.query(
        `SELECT id FROM partner WHERE archived = false AND lower(email) = lower($1) LIMIT 1`,
        [c.email],
      );
      if (dupe.length) {
        skipped++;
        console.log(`  skip (exists): ${c.name}`);
        continue;
      }
      if (commit) {
        await pool.query(
          `INSERT INTO partner (name, website, email, instagram, linkedin, facebook, status, show_on_website)
           VALUES ($1, $2, $3, $4, $5, $6, 'lead', false)`,
          [c.name, c.website, c.email, c.instagram, c.linkedin, c.facebook],
        );
      }
      inserted++;
      console.log(`  ${commit ? "insert" : "WOULD insert"}: ${c.name}  <${c.email}>`);
    }
    console.log(
      `\n${commit ? "Committed" : "Dry run"} — ${inserted} new lead(s), ${skipped} skipped (already present), ${CLUBS.length} total in source.`,
    );
    if (!commit) console.log("Re-run with --commit to write to the database.");
  } finally {
    await pool.end();
  }
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
