export const ROLES = {
  JOBS: new Set([
    "Light Infantry",
    "Mechanized Infantry",
    "Force Recon",
    "Airborne"
  ]),

  TEAMS: new Set([
    "Nomad 1-1",
    "Odin 3-1",
    "Pathfinder 5-1",
    "Ronin 7-1",
    "Overflow Regiment 9-1",
    "Tempest 1-3",
    "Naval Lance 1-4"
  ]),

  PERMISSIONS: new Set([
    "Company CO", "Company XO", "Company Corpsman", "Company Tech Spec.",
    "Wing CO", "Wing XO",
    "Platoon Leader", "Platoon XO", "Platoon Corpsman", "Platoon Tech Spec.", "Platoon Combat Aviator",
    "Squadron CO", "Squadron XO",
    "Team Leader", "Flight Team Leader", "Flight Team XO"
  ]),

  RANKS: new Set([
    "Rct", "Pvt", "Pfc", "Lcpl", "Cpl", "Sgt", "SSgt", "GySgt", "MSgt",
    "1stSgt", "SgtMaj", "2ndLt", "1stLt", "Capt", "Maj", "LtCol", "Col", "LCpl"
  ])
};

export const RoleUtils = {
  DEFAULT: "Undefined",

  getMemberRoles(member) {
    return member?.roles?.cache?.map(role => role.name.toLowerCase()) ?? [];
  },

  findRole(memberRoles, validRoles) {
    return [...validRoles].find(role => 
      memberRoles.includes(role.toLowerCase())
    ) ?? this.DEFAULT;
  },

  getJob(member) {
    return this.findRole(this.getMemberRoles(member), ROLES.JOBS);
  },

  getTeam(member) {
    return this.findRole(this.getMemberRoles(member), ROLES.TEAMS);
  },

  getRank(member) {
    let rank = this.findRole(this.getMemberRoles(member), ROLES.RANKS);
    if (rank === this.DEFAULT) {
      const nickname = member.nickname || member.user.username;
      const words = nickname.split(/\s+/);
      const potentialRank = words[0].trim().toLowerCase().replace(/[^a-z]/g, '');
      const rankSet = [...ROLES.RANKS].map(r => r.toLowerCase());
      if (rankSet.includes(potentialRank)) {
        rank = potentialRank.toUpperCase();
      }
    }
    return rank;
  },

  hasPermission(member) {
    return member.user.username === "kaleb6768" ||
      this.getMemberRoles(member).some(role => 
        [...ROLES.PERMISSIONS].some(perm => 
          role === perm.toLowerCase()
        )
      );
  }
};