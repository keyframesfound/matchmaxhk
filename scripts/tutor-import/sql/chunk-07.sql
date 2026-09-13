INSERT INTO public.tutors (tutor_code, display_name, headline, subjects, district, stations, hourly_rate, badge, is_published, experience_years, languages, exam_results, lesson_mode, gender, university, target_students, qualifications_summary, achievements, ia_ee_tok_support, ia_ee_tok_notes, academic_headline, secondary_school, card_highlights) VALUES
  ('MM-T034', 'MM-T034', NULL, '{}'::text[], NULL, '{}'::text[], 150, NULL, false, NULL, '{}'::text[], '[]'::jsonb, 'either', 'male', NULL, '{}'::text[], NULL, '[]'::jsonb, '{}'::text[], NULL, NULL, NULL, '{}'::text[]),
  ('MM-T035', 'MM-T035', 'SAT 1580 Elite Scorer 📈 | GSMST Scholar 🎓 | AP STEM & Computer Science Specialist 🎯', ARRAY['AP Calculus BC', 'AP Precalculus', 'AP Statistics', 'AP Biology', 'AP Computer Science A', 'AP World History', 'AP Human Geography', 'AP Seminar']::text[], NULL, '{}'::text[], 400, NULL, true, NULL, ARRAY['English']::text[], '[{"system":"sat","subjects":[{"grade":"1580","subject":"SAT Total"}]},{"system":"ap","subjects":[{"grade":"5","subject":"AP Calculus BC"},{"grade":"5","subject":"AP Computer Science A"},{"grade":"5","subject":"AP Biology"},{"grade":"5","subject":"AP Statistics"},{"grade":"5","subject":"AP Precalculus"},{"grade":"5","subject":"AP World History"},{"grade":"5","subject":"AP Human Geography"},{"grade":"5","subject":"AP Seminar"}]}]'::jsonb, 'online', 'male', NULL, ARRAY['AP']::text[], '• **SAT 1580** with a perfect AP sweep — **Grade 5 in 8+ rigorous AP subjects** 🏆

• Student at the **Gwinnett School of Mathematics, Science, and Technology (GSMST)** — a top-tier US STEM high school 🎓

• **AP Computer Science A specialist:** core logic, object-oriented programming (OOP), and debugging mastery 💻

• AP humanities coaching: World History & Human Geography essay structures (SAQ/DBQ/LEQ) with analytical precision ✍️

• Strategic SAT coaching targeted at students aiming for elite, top-percentile scores 📈', '[]'::jsonb, '{}'::text[], NULL, 'SAT 1580 | 8× AP Grade 5', 'Gwinnett School of Mathematics, Science & Technology', ARRAY['SAT 1580 | 8× AP Grade 5 Sweep 🏆', 'GSMST — Top US STEM High School 🎓', 'AP CSA, Calc BC, Stats & Sciences 💻']::text[]),
  ('MM-T036', 'MM-T036', 'ASU Electrical Engineering ⚙️ | AP Scholar with Distinction 🏆 | AP Math, English & History Specialist 📐', ARRAY['AP Precalculus', 'AP Calculus AB', 'AP English Language', 'AP World History', 'AP US Government']::text[], NULL, '{}'::text[], 300, 'ASU Electrical Engineering', true, 5, ARRAY['English']::text[], '[{"system":"ap","subjects":[{"grade":"5","subject":"AP Precalculus"},{"grade":"5","subject":"AP Calculus AB"},{"grade":"5","subject":"AP English Language"},{"grade":"4","subject":"AP Calculus BC"},{"grade":"4","subject":"AP English Literature"},{"grade":"4","subject":"AP World History"},{"grade":"4","subject":"AP US Government"}]}]'::jsonb, 'online', NULL, 'Arizona State University', ARRAY['AP']::text[], '• **AP Scholar with Distinction & College Board National Recognition Scholar** 🏆

• Grade 5 in AP PreCalculus, AP Calculus AB & AP English Language; incoming **Electrical Engineering student at Arizona State University** ⚙️

• **5+ years of tutoring and coaching** across private lessons, school clubs, and community programs ♟️

• Personally prepares structured lesson plans, step-by-step conceptual breakdowns, and active-recall practice materials 🧠

• 100% English medium of instruction 🇬🇧', '[]'::jsonb, '{}'::text[], NULL, '5× AP Grade 5 | AP Scholar w/ Distinction', NULL, ARRAY['AP Scholar with Distinction 🏆', 'AP Precalc, Calc AB & Eng Lang Grade 5 📐📖', '5+ Years Teaching & Coaching Experience ♟️']::text[]),
  ('MM-T037', 'MM-T037', 'IB 44/45 🏅 | Island School Graduate 🎓 | CUHK Medicine GPS (Incoming) 🩺', ARRAY['Bio HL', 'Chem HL', 'Chin B HL', 'Geog SL', 'Eng A Lang Lit SL', 'Math AA SL', 'IGCSE Physics', 'IGCSE Chemistry', 'IGCSE Biology', 'IGCSE Chinese', 'IGCSE Math']::text[], NULL, '{}'::text[], 550, 'CUHK Medicine (MBChB GPS)', true, 3, ARRAY['English', 'Cantonese', 'Mandarin']::text[], '[{"system":"ib","subjects":[{"grade":"7","subject":"Chem HL"},{"grade":"7","subject":"Bio HL"},{"grade":"7","subject":"Eng A Lang Lit SL"},{"grade":"7","subject":"Geog SL"},{"grade":"7","subject":"Math AA SL"},{"grade":"7","subject":"Chin B HL"}]}]'::jsonb, 'online', 'female', 'CUHK', ARRAY['IBDP', 'IGCSE']::text[], '• **IB 44/45** with Grade 7 in Chemistry HL, Biology HL, English A Lang & Lit SL, Geography SL, Math AA SL & Chinese B HL 🏅

• Admitted to **CUHK Medicine — Global Physician-Leadership Stream (MBChB GPS)** 🩺

• **Principal''s Medal for four consecutive years (Y10–Y13)** at Island School; **IGCSE Triple Award** 🥇

• Tutoring since Year 10; currently teaching 3 regular IB Chemistry and Biology students 👨‍🏫

• Online-only lessons with HK/UK medical admissions guidance 🏥', '[]'::jsonb, '{}'::text[], NULL, 'IBDP 44/45', 'Island School', ARRAY['IB 44/45 | CUHK MBChB GPS Incoming 🩺', '5 Grade 7s incl. Chem HL & Bio HL 🧪🧬', 'IGCSE Triple Award | Principal''s Medal ×4 🥇']::text[])
ON CONFLICT (tutor_code) DO NOTHING;
