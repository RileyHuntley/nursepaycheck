// Known schedule and pay statement portals for BC health authorities
export const HA_PORTALS = {
  VCH: {
    label: 'Vancouver Coastal',
    schedule: { label: 'My Schedule', url: 'https://myschedule.vch.ca/employee/' },
    pay: { label: 'My Info (Pay Stmt)', url: 'https://myinfo.vch.ca' },
  },
  FH: {
    label: 'Fraser Health',
    schedule: { label: 'MySchedule', url: 'https://myschedule.fraserhealth.ca/' },
    pay: { label: 'myFHinfo', url: 'https://go.fraserhealth.ca/' },
  },
  VIHA: {
    label: 'Island Health',
    schedule: { label: 'MySchedule', url: 'https://myschedule.islandhealth.ca/' },
    pay: { label: 'ESS Pay Stubs', url: 'https://selfservice.viha.ca/' },
  },
  IH: {
    label: 'Interior Health',
    schedule: { label: 'IH Anywhere', url: 'https://ihanywhere.interiorhealth.ca/' },
    pay: { label: 'IH Anywhere', url: 'https://ihanywhere.interiorhealth.ca/' },
  },
  NH: {
    label: 'Northern Health',
    schedule: { label: 'mySchedule', url: 'https://myschedule.northernhealth.ca/' },
    pay: { label: 'Staff Portal', url: 'https://www.northernhealth.ca/staff' },
  },
  PHSA: {
    label: 'PHSA',
    pay: { label: 'Paperless Pay', url: 'https://pay.phsa.ca/' },
  },
  PHC: {
    label: 'Providence',
    schedule: { label: 'MySchedule', url: 'https://andgo.phcnet.ca/' },
    pay: { label: 'EPS Pay Stmt', url: 'https://myinfo.providencehealthcare.org/' },
  },
};

// Returns unique health authorities from the user's hospitals list
export function getUserHealthAuthorities(hospitals) {
  if (!hospitals || hospitals.length === 0) return [];
  const seen = new Set();
  return hospitals
    .filter(h => {
      const ha = h.health_authority;
      if (!ha || seen.has(ha)) return false;
      // Only return HAs that have known portals
      if (!HA_PORTALS[ha]) return false;
      seen.add(ha);
      return true;
    })
    .map(h => h.health_authority);
}