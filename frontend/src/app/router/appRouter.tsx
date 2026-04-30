import { createBrowserRouter, Navigate } from "react-router-dom";

import { ProtectedRoute } from "./ProtectedRoute";
import { RoleBasedRoute } from "./RoleBasedRoute";
import { AuthLayout } from "../../layouts/AuthLayout";
import { StudentLayout } from "../../layouts/StudentLayout";
import { ProfessorLayout } from "../../layouts/ProfessorLayout";
import { AdminLayout } from "../../layouts/AdminLayout";

import { LoginPage } from "../../pages/auth/LoginPage";
import { RegisterPage } from "../../pages/auth/RegisterPage";

import { StudentDashboardPage } from "../../pages/student/StudentDashboardPage";
import { StudentSlotsPage } from "../../pages/student/StudentSlotsPage";
import { StudentBookingsPage } from "../../pages/student/StudentBookingsPage";
import { StudentReservationsPage } from "../../pages/student/StudentReservationsPage";
import { CalendarPage } from "../../pages/common/CalendarPage";

import { ProfessorDashboardPage } from "../../pages/professor/ProfessorDashboardPage";
import { ProfessorSlotsPage } from "../../pages/professor/ProfessorSlotsPage";
import { ProfessorBookingsPage } from "../../pages/professor/ProfessorBookingsPage";

import { AdminDashboardPage } from "../../pages/admin/AdminDashboardPage";
import { AdminBookingsPage } from "../../pages/admin/AdminBookingsPage";
import { AdminReservationsPage } from "../../pages/admin/AdminReservationsPage";
import { AdminClassroomsPage } from "../../pages/admin/AdminClassroomsPage";
import { AdminAnalyticsPage } from "../../pages/admin/AdminAnalyticsPage";

import { NotFoundPage } from "../../pages/NotFoundPage";
import { ForbiddenPage } from "../../pages/ForbiddenPage";
import { RootIndexRedirect } from "../../pages/RootIndexRedirect";
import { NotificationsPage } from "../../pages/common/NotificationsPage";
import { ProfilePage } from "../../pages/common/ProfilePage";

export const appRouter = createBrowserRouter([
  {
    element: <AuthLayout />,
    children: [
      { path: "/login", element: <LoginPage /> },
      { path: "/register", element: <RegisterPage /> },
    ],
  },
  { path: "/403", element: <ForbiddenPage /> },
  {
    element: <ProtectedRoute />,
    children: [
      {
        // Common protected pages must still use the app shell layout,
        // otherwise sidebar/topbar disappear.
        element: <StudentLayout />,
        children: [
          { index: true, element: <RootIndexRedirect /> },
          { path: "/notifications", element: <NotificationsPage /> },
          { path: "/profile", element: <ProfilePage /> },
        ],
      },
      {
        element: <RoleBasedRoute roles={["student"]} />,
        children: [
          {
            element: <StudentLayout />,
            children: [
              { path: "/student", element: <StudentDashboardPage /> },
              { path: "/student/dashboard", element: <StudentDashboardPage /> },
              { path: "/student/slots", element: <StudentSlotsPage /> },
              { path: "/student/bookings", element: <StudentBookingsPage /> },
              { path: "/student/reservations", element: <StudentReservationsPage /> },
              { path: "/student/notifications", element: <NotificationsPage /> },
              { path: "/student/calendar", element: <CalendarPage /> },
            ],
          },
        ],
      },
      {
        element: <RoleBasedRoute roles={["professor"]} />,
        children: [
          {
            element: <ProfessorLayout />,
            children: [
              { path: "/professor", element: <ProfessorDashboardPage /> },
              { path: "/professor/dashboard", element: <ProfessorDashboardPage /> },
              { path: "/professor/slots", element: <ProfessorSlotsPage /> },
              { path: "/professor/bookings", element: <ProfessorBookingsPage /> },
              { path: "/professor/calendar", element: <CalendarPage /> },
            ],
          },
        ],
      },
      {
        element: <RoleBasedRoute roles={["admin"]} />,
        children: [
          {
            element: <AdminLayout />,
            children: [
              { path: "/admin", element: <AdminDashboardPage /> },
              { path: "/admin/dashboard", element: <AdminDashboardPage /> },
              { path: "/admin/bookings", element: <AdminBookingsPage /> },
              { path: "/admin/reservations", element: <AdminReservationsPage /> },
              { path: "/admin/classrooms", element: <AdminClassroomsPage /> },
              { path: "/admin/analytics", element: <AdminAnalyticsPage /> },
            ],
          },
        ],
      },
      { path: "/app", element: <Navigate to="/" replace /> },
    ],
  },
  { path: "*", element: <NotFoundPage /> },
]);

