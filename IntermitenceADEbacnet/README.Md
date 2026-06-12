# Intermittence ADE BACnet

This Node-RED flow synchronizes room occupancy schedules from an ADE calendar (exported in iCal format) with a controller using the BACnet/IP protocol. Its purpose is to drive heating in intermittent mode: a room is heated only when it is occupied, with the warm-up anticipated ahead of each booking and the setpoint released before the end of the booking to take advantage of the building's thermal inertia.

## How It Works

At a fixed interval the flow retrieves the events from the ADE calendar of each room, converts those events into a BACnet weekly schedule, and writes that schedule into the Schedule object of the target BACnet controller.

For every occupancy slot, two time points are generated. The start point is computed as the event start time minus the preheat time and writes the exception value, meaning the room is occupied and the system runs. The stop point is computed as the event end time minus the inertia time and writes the default value, meaning the room is treated as unoccupied and the system stops. The preheat time anticipates the warm-up so the room reaches temperature by the time the class begins, while the inertia time cuts the setpoint before the end, the building retaining enough heat until the occupants leave.

## Architecture

The flow is built around two trigger chains. An initialization chain runs once at startup: an inject node fires the TO CONFIGURE function, which loads every configuration variable into the flow context. A synchronization chain runs at startup and then every twelve hours: an inject node feeds the room queue function, which iterates over the configured rooms and emits one message per room. A rate-limiting delay then spaces out the requests before the Get Room calendar node fetches the events over a seven-day horizon. A second delay precedes the InterpretSchedule function, which holds the logic that turns the iCal events into a BACnet weekly schedule. Finally the bacnet_client_WeeklyWrite function writes the WEEKLY_SCHEDULE property of the SCHEDULE object onto the controller.


## Configuration

All configuration is done inside the TO CONFIGURE function node, which defines a set of global variables and a per-room parameter array.

The global variables are the BACnet destination port (default 47808), the UTC offset in hours applied to the calendar times to convert them to local time (default 2), and the BACnet broadcast address .

The per-room parameters live in the schedulesParameters array, which lets the flow manage several rooms at once. Each entry describes one room and its controller. The url field is the iCal export URL of the room's ADE schedule .The scheduleid is the instance number of the BACnet Schedule object to write. The targetip is the IP address of the target BACnet controller. The exceptionvalue is the value written during occupancy, and the defaultvalue is the value written outside occupancy. The inertiatime is how many minutes before the event end the system stops, and the preheattime is how many minutes before the event start the system is brought online. To add a room, duplicate one object in the schedulesParameters array and give it its own url, scheduleid, and targetip.

## Logic

The InterpretSchedule function first converts each event date to local time using the UTC ofset. It then generates the warm-up point by subtracting the preheat time from the start, and the stop point by subtracting the inertia time from the end. For each day, the function scans the points and, whenever a time appears earlier than the preceding one, it removes the pair; this filters out overlapping bookings. The output is a seven-day weekly array in which each entry is expressed in BACnet form, pairing a time value with an unsigned integer value.

## Dependencies

The flow relies on the @bacnet-js/client module, used as the BACnet/IP client for reading and writing properties, and on node-red-contrib-ical-events version 2.2.5, used to retrieve and parse the iCal calendars .The bacnet module is declared inside the function nodes through their Setup and Modules section.

## Installation 

Import the flow into Node-RED through the import menu, install the dependencies above. Open the TO CONFIGURE node and fill in the ADE URLs, the target IP addresses, the schedule identifiers, the values and the warm-up and inertia times, as well as the UTC offset for the current period of the year. Deploy the flow. The startup inject initializes the configuration and the twelve-hour inject launches the first synchronization. The state can then be checked on the debug nodes that display the computed schedule.

