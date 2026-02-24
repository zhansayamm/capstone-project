# capstone-project
final project - Booking Time

description : Booking Time is a web-based enterprise system designed to digitalize and optimize scheduling processes within a university environment. The platform centralizes office hour bookings, classroom reservations, and administrative monitoring into a single integrated system. The application enables students to book appointments with professors during available office hours through a structured and transparent interface. Professors can manage their availability, control appointment slots, and monitor student bookings. University administrators gain access to an analytics dashboard that provides insights into system usage, resource allocation, and scheduling efficiency.

Team members : 
Aisha Kenzhebayeva – Backend Developer 230103248@sdu.edu.kz
Zhansaya Medetkhanova - Frontend Developer 230103275@sdu.edu.kz
Shynar Zhamay - Data Analyst 230103338@sdu.edu.kz

Frontend: React or other JS framework
Backend: python FastAPI
Database: PostgreSQL
Cloud / Hosting:
APIs / Integrations: JWT Authentication
Other Tools: Git & GitHub, Figma (UI/UX design), Insomnia (API testing)

We convert each room’s geographic coordinates into an H3 hexagonal index at resolution 9. This index is stored in the database and used for efficient regional filtering, nearby search using k-ring, and campus congestion analytics through GROUP BY aggregation. Instead of performing expensive GIS joins, we operate on indexed hex values, which improves performance and scalability.

to run this file, you need to first of all have FastAPI and then run.
