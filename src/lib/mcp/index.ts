import { auth, defineMcp } from "@lovable.dev/mcp-js";
import listMyExams from "./tools/list-my-exams";
import getExam from "./tools/get-exam";
import listMyResults from "./tools/list-my-results";
import getAttemptInsights from "./tools/get-attempt-insights";
import getExamAnalytics from "./tools/get-exam-analytics";
import listStudents from "./tools/list-students";

const projectRef = import.meta.env.VITE_SUPABASE_PROJECT_ID ?? "project-ref-unset";

export default defineMcp({
  name: "examprep-mcp",
  title: "ExamPrep",
  version: "0.1.0",
  instructions:
    "Tools for the ExamPrep app. Students can list assigned exams, view their results, and fetch AI insights. Admins can additionally list students and view exam analytics. All access is enforced by the app's row-level security using the signed-in user.",
  auth: auth.oauth.issuer({
    issuer: `https://${projectRef}.supabase.co/auth/v1`,
    acceptedAudiences: "authenticated",
  }),
  tools: [
    listMyExams,
    getExam,
    listMyResults,
    getAttemptInsights,
    getExamAnalytics,
    listStudents,
  ],
});
