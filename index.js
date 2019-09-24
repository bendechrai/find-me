#!/usr/bin/env node
const argv = require(`yargs`)
  .boolean([`json`,`historical`])
  .option(`json`, {
    alias: `j`,
    describe: `Output as JSON instead of human readable`,
    default: false
  })
  .option(`historical`, {
    alias: `h`,
    describe: `Show historical events too`,
    default: false
  })
  .argv;

const parser = require('vdata-parser');
const request = require('request');
const boxen = require("boxen");
const chalk = require("chalk");

const meetup = chalk.cyan;
const conference = chalk.yellow;
const heading = chalk.bold.green;
const key = chalk.underline;

const cardOptions = {
  padding: 1,
  margin: 1,
  borderStyle: 'double',
  borderColor: 'gray'
};

// Pull in calendar data
request.get(
  'https://cloud.priva.si/remote.php/dav/public-calendars/XRoYgPaKkJ88mXYp?export',
  (error, response, body) => error ? console.log(`Couldn't load calendar`) : processCalendar(body)
);

// Process the calendar data
function processCalendar(data) {

  const vCal = parser.fromString(data).VCALENDAR.VEVENT;
  let events = { speaker: [], host: [] };

  vCal.forEach((vEvent) => {

    // The event description contains VCAL encoded JSON, which needs fixing up 
    let details = decodeDescription(vEvent.DESCRIPTION);

    // Decode the JSON
    try {
      details = JSON.parse(details);
    } catch(e) {
      details = {
        "malformedJson": true,
        "originalData": details
      };
    }

    // Build and store the event info in the right event list
    let event = {
      start     : getDatum(vEvent.DTSTART.value).slice(0,8),
      name      : getDatum(vEvent.SUMMARY),
      location  : getDatum(vEvent.LOCATION),
      role      : getDatum(details.role),
      type      : getDatum(details.type),
    };
    events[event.role].push(event);

  });

  // Sort the lists of events
  const sortByStartDate = (a,b) => a.start - b.start;
  events.speaker.sort(sortByStartDate);
  events.host.sort(sortByStartDate);

  // Remove past events
  if(!argv.historical) {
    let today = new Date();
    today = today.getFullYear().toString() + (today.getMonth()+1).toString().padStart(2, "0") + today.getDate().toString().padStart(2, "0");
    const filterByStartDate = (a) => a.start > today;
    events.speaker = events.speaker.filter(filterByStartDate);
    events.host = events.host.filter(filterByStartDate);
  }

  // Render events
  if(argv.json) {
    console.log(JSON.stringify(events));
  } else {
    renderBox(events);
  }

}

function getDatum(input) {
  let datum = input || "";
  datum = datum.replace(/\\,/g, ',');
  return datum;
}

function decodeDescription(details) {

    // Get event details, which should be JSON
    details = details || '{}';

    // Remove new lines after commas and open braces, and before close braces
    details = details.replace(/\\, *\\n/g, ',');
    details = details.replace(/{ *\\n/g, '{');
    details = details.replace(/\\n *}/g, '}');

    // Unslash chars that break JSON.parse
    details = details.replace(/\\,/g, ',');
    details = details.replace(/\\;/g, ';');
    details = details.replace(/\\'/g, "'");

    return details;
}


function renderBox(events) {

  // Build speaking events
  let content = `${heading("Ben\'s Speaking Events")}\n\n`;
  events.speaker.forEach((event) => content += renderEventLine(event));

  // Build hosting events
  content += `\n${heading("Ben\'s Hosting Events")}\n\n`;
  events.host.forEach((event) => content += renderEventLine(event));

  // Build key
  content += `\n\n${key.inverse("Key:")} ${conference.inverse(" Conference ")} ${meetup.inverse(" Meetup ")}`;

  // Render content
  console.log(boxen(content, cardOptions));

}

function renderEventLine(event) {

    // Colour changes based on event type
    let colour = event.type === 'conference' ? conference : meetup;

    // Make a nicer date
    const dateParts = event.start.split(/(....)(..)(..)/);
    let friendlyDate = new Date(dateParts[1], dateParts[2]-1, dateParts[3]);
    friendlyDate = friendlyDate.toDateString();

    // Fix the obviously wrong order of components from toDateString()
    friendlyDate = friendlyDate.replace(/(...) (...) (..) (....)/, `$1 $3 $2 $4`);

    return `${colour(friendlyDate)}   ${colour(event.name.padEnd(50).slice(0,50))}    ${colour(event.location.padStart(30).slice(-30))}\n`;
}
