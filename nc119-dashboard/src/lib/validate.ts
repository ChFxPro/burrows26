import type { DashboardData } from '../types';

interface Ok {
  ok: true;
  data: DashboardData;
}

interface Err {
  ok: false;
  errors: string[];
}

export type ValidationResult = Ok | Err;

const isRecord = (value: unknown): value is Record<string, unknown> => {
  return typeof value === 'object' && value !== null && !Array.isArray(value);
};

const isNumber = (value: unknown): value is number => {
  return typeof value === 'number' && Number.isFinite(value);
};

const isString = (value: unknown): value is string => {
  return typeof value === 'string';
};

const pushTypeError = (errors: string[], field: string, expected: string): void => {
  errors.push(`Field \"${field}\" must be ${expected}.`);
};

export const validateDashboardData = (value: unknown): ValidationResult => {
  const errors: string[] = [];

  if (!isRecord(value)) {
    return { ok: false, errors: ['Root dashboard JSON must be an object.'] };
  }

  const { meta, statewide, party, nc119, electionNight } = value;

  if (!isRecord(meta)) {
    pushTypeError(errors, 'meta', 'an object');
  } else {
    ['title', 'subtitle', 'source', 'sourceFile', 'lastUpdatedISO', 'dataThroughISO'].forEach((key) => {
      if (!isString(meta[key])) {
        pushTypeError(errors, `meta.${key}`, 'a string');
      }
    });

    if (!Array.isArray(meta.notes) || meta.notes.some((entry) => !isString(entry))) {
      pushTypeError(errors, 'meta.notes', 'a string array');
    }
  }

  if (!isRecord(statewide)) {
    pushTypeError(errors, 'statewide', 'an object');
  } else {
    ['eligibleVoters', 'totalBallotsCast', 'turnoutPct'].forEach((key) => {
      if (!isNumber(statewide[key])) {
        pushTypeError(errors, `statewide.${key}`, 'a number');
      }
    });

    if (!Array.isArray(statewide.ballotsByMethod)) {
      pushTypeError(errors, 'statewide.ballotsByMethod', 'an array');
    } else {
      statewide.ballotsByMethod.forEach((row, index) => {
        if (!isRecord(row)) {
          pushTypeError(errors, `statewide.ballotsByMethod[${index}]`, 'an object');
          return;
        }

        if (!isString(row.method)) {
          pushTypeError(errors, `statewide.ballotsByMethod[${index}].method`, 'a string');
        }
        if (!isNumber(row.count)) {
          pushTypeError(errors, `statewide.ballotsByMethod[${index}].count`, 'a number');
        }
      });
    }

    if (!isRecord(statewide.comparison2022)) {
      pushTypeError(errors, 'statewide.comparison2022', 'an object');
    } else {
      const comparison2022 = statewide.comparison2022;
      ['totalAcceptedBallots', 'earlyVoting', 'mailTotal'].forEach((key) => {
        if (!isNumber(comparison2022[key])) {
          pushTypeError(errors, `statewide.comparison2022.${key}`, 'a number');
        }
      });
    }
  }

  if (!isRecord(party)) {
    pushTypeError(errors, 'party', 'an object');
  } else {
    if (!Array.isArray(party.registration)) {
      pushTypeError(errors, 'party.registration', 'an array');
    } else {
      party.registration.forEach((row, index) => {
        if (!isRecord(row)) {
          pushTypeError(errors, `party.registration[${index}]`, 'an object');
          return;
        }
        if (!isString(row.party)) {
          pushTypeError(errors, `party.registration[${index}].party`, 'a string');
        }
        if (!isNumber(row.count)) {
          pushTypeError(errors, `party.registration[${index}].count`, 'a number');
        }
        if (!isNumber(row.pct)) {
          pushTypeError(errors, `party.registration[${index}].pct`, 'a number');
        }
      });
    }

    if (!Array.isArray(party.ballotsCast)) {
      pushTypeError(errors, 'party.ballotsCast', 'an array');
    } else {
      party.ballotsCast.forEach((row, index) => {
        if (!isRecord(row)) {
          pushTypeError(errors, `party.ballotsCast[${index}]`, 'an object');
          return;
        }
        if (!isString(row.party)) {
          pushTypeError(errors, `party.ballotsCast[${index}].party`, 'a string');
        }
        ['count', 'sharePct', 'turnoutPct'].forEach((key) => {
          if (!isNumber(row[key])) {
            pushTypeError(errors, `party.ballotsCast[${index}].${key}`, 'a number');
          }
        });
      });
    }

    if (!isString(party.minorPartiesNote)) {
      pushTypeError(errors, 'party.minorPartiesNote', 'a string');
    }
  }

  if (!isRecord(nc119)) {
    pushTypeError(errors, 'nc119', 'an object');
  } else {
    if (!isString(nc119.districtLabel)) {
      pushTypeError(errors, 'nc119.districtLabel', 'a string');
    }

    if (!Array.isArray(nc119.counties)) {
      pushTypeError(errors, 'nc119.counties', 'an array');
    } else {
      nc119.counties.forEach((row, index) => {
        if (!isRecord(row)) {
          pushTypeError(errors, `nc119.counties[${index}]`, 'an object');
          return;
        }

        if (!isString(row.county)) {
          pushTypeError(errors, `nc119.counties[${index}].county`, 'a string');
        }

        ['inPersonEarly', 'civilianMail', 'militaryMail', 'overseasMail', 'total'].forEach((key) => {
          if (!isNumber(row[key])) {
            pushTypeError(errors, `nc119.counties[${index}].${key}`, 'a number');
          }
        });
      });
    }
  }

  if (!isRecord(electionNight)) {
    pushTypeError(errors, 'electionNight', 'an object');
  } else {
    if (typeof electionNight.enabled !== 'boolean') {
      pushTypeError(errors, 'electionNight.enabled', 'a boolean');
    }

    if (!isRecord(electionNight.placeholders)) {
      pushTypeError(errors, 'electionNight.placeholders', 'an object');
    } else {
      const precinctsReporting = electionNight.placeholders.precinctsReportingPct;
      if (!(precinctsReporting === null || isNumber(precinctsReporting))) {
        pushTypeError(errors, 'electionNight.placeholders.precinctsReportingPct', 'a number or null');
      }

      const totalVotesSoFar = electionNight.placeholders.totalVotesSoFar;
      if (!(totalVotesSoFar === null || isNumber(totalVotesSoFar))) {
        pushTypeError(errors, 'electionNight.placeholders.totalVotesSoFar', 'a number or null');
      }

      if (!Array.isArray(electionNight.placeholders.topRaces)) {
        pushTypeError(errors, 'electionNight.placeholders.topRaces', 'an array');
      } else {
        electionNight.placeholders.topRaces.forEach((row, index) => {
          if (!isRecord(row)) {
            pushTypeError(errors, `electionNight.placeholders.topRaces[${index}]`, 'an object');
            return;
          }

          if (!isString(row.race)) {
            pushTypeError(errors, `electionNight.placeholders.topRaces[${index}].race`, 'a string');
          }

          if (!isString(row.leader)) {
            pushTypeError(errors, `electionNight.placeholders.topRaces[${index}].leader`, 'a string');
          }

          if (!isNumber(row.votes)) {
            pushTypeError(errors, `electionNight.placeholders.topRaces[${index}].votes`, 'a number');
          }

          if (!isNumber(row.pct)) {
            pushTypeError(errors, `electionNight.placeholders.topRaces[${index}].pct`, 'a number');
          }
        });
      }
    }
  }

  if (errors.length > 0) {
    return { ok: false, errors };
  }

  return { ok: true, data: value as unknown as DashboardData };
};
