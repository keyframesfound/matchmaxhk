INSERT INTO public.tutors (tutor_code, display_name, headline, subjects, district, stations, hourly_rate, badge, is_published, experience_years, languages, exam_results, lesson_mode, gender, university, target_students, qualifications_summary, achievements, ia_ee_tok_support, ia_ee_tok_notes, academic_headline, secondary_school, card_highlights) VALUES
  ('MM-T099', 'MM-T099', 'IB 41/45 🏅 | GT College Graduate 🎓 | PolyU Physiotherapy 🩺 & 2× iGEM Gold Medalist 🧬', ARRAY['Eng B HL', 'Math AA SL', 'Bio HL']::text[], NULL, '{}'::text[], 300, 'PolyU Physiotherapy', true, NULL, ARRAY['English', 'Cantonese']::text[], '[{"system":"ib","subjects":[{"grade":"7","papers":[{"label":"Writing","score":"29/30"},{"label":"Oral","score":"28/30"}],"subject":"Eng B HL"},{"grade":"7","subject":"Math AA SL"},{"grade":"6","subject":"Bio HL"}]}]'::jsonb, 'online', 'male', 'PolyU', ARRAY['IBDP', 'IGCSE']::text[], '• **IB 41/45 (2025 cohort)** with English B HL **Grade 7** (Writing 29/30, Oral 28/30) and Math AA SL Grade 7 🏅

• **Biology EE Grade A** with Grade-A quality IA/EE mentorship: topic selection, data analysis & structure 📝

• **2× iGEM Gold Medalist (2023 & 2025)**; ISSF Outstanding Project Award; ISPC First Runner-Up 🥇

• **BSc (Hons) Physiotherapy at The Hong Kong Polytechnic University (PolyU)**; former CUHK Robotics Lab intern 🩺🤖

• Online 1-on-1 lessons via Zoom / Google Meet 💻', '[]'::jsonb, ARRAY['EE', 'IA']::text[], NULL, 'IBDP 41/45', 'GT (Ellen Yeung) College', ARRAY['IB 41/45 | Eng B HL & Math AA SL Grade 7 ✍️➗', '2× iGEM Gold Medalist (2023 & 2025) 🥇', 'PolyU Physiotherapy | CUHK Robotics Lab Intern 🤖']::text[]),
  ('MM-T100', 'MM-T100', 'HKUST BBA 🎓 | Holy Trinity College Alum 🏛️ | DSE BAFS 5* & Econ 5 Specialist 📊', ARRAY['BAFS', 'Economics']::text[], 'Within Kowloon', ARRAY['Po Lam', 'Tseung Kwan O', 'Choi Hung', 'Diamond Hill', 'Prince Edward', 'Mong Kok']::text[], 250, 'HKUST BBA', true, NULL, ARRAY['English', 'Cantonese']::text[], '[{"system":"dse","subjects":[{"grade":"5*","subject":"BAFS"},{"grade":"5","subject":"Economics"}]}]'::jsonb, 'either', 'female', 'HKUST', ARRAY['Senior Secondary']::text[], '• **HKDSE BAFS 5\*** and **Economics 5** with intimate familiarity with HKEAA marking rubrics 📊

• **HKUST Bachelor of Business Administration** (2026 cohort); Holy Trinity College alumnus 🎓

• Current **BAFS teaching assistant** at a leading large-scale tutorial institute — marking, diagnosis & case breakdowns 💼

• Paper 1 MC skills, Paper 2 structured questions, case-study frameworks & graphical analysis training 📝

• In person: Po Lam, TKO, Choi Hung, Diamond Hill, Prince Edward, Mong Kok — or online 💻', '[]'::jsonb, '{}'::text[], NULL, 'HKDSE BAFS: 5*', 'Holy Trinity College', ARRAY['DSE BAFS 5* & Economics 5 📊📈', 'HKUST BBA (2026 Cohort) 🎓', 'BAFS TA at a leading tutorial institute 💼']::text[]),
  ('MM-T101', 'MM-T101', 'HKUST Engineering 🎓 | GCE A-Level A/A* Specialist 🧪📐 | 4 Years Tutoring Mastery 👨‍🏫', ARRAY['IGCSE Mathematics', 'IGCSE Chemistry', 'IGCSE Physics', 'A-Level Mathematics', 'A-Level Chemistry']::text[], 'Within New Territories', ARRAY['Tseung Kwan O', 'Hang Hau']::text[], 330, 'HKUST Engineering', true, 4, ARRAY['English', 'Cantonese']::text[], '[{"system":"alevel","subjects":[{"grade":"A*","subject":"Chemistry"},{"grade":"A*","subject":"Physics"},{"grade":"A","subject":"Mathematics"},{"grade":"A","subject":"Further Mathematics"}]}]'::jsonb, 'either', 'male', 'HKUST', ARRAY['A-Level', 'IGCSE']::text[], '• **GCE A-Level straight A/A\***: Chemistry A*, Physics A*, Mathematics A, Further Mathematics A 🧪📐

• **BEng Decision Analytics at HKUST** (2027 cohort) with rigorous modelling and analytical training 💻

• **4 years of dedicated private tutoring** with consistent student grade improvements 📈

• Deep mastery of **Edexcel & Cambridge CAIE** mark schemes, multi-step problems, and A* techniques ✍️

• In person around Tseung Kwan O or online via Zoom / Google Meet 🚇', '[]'::jsonb, '{}'::text[], NULL, 'A-Level A* A* A A', NULL, ARRAY['A-Level: Chem A*, Phy A*, Math & FM A 🧪⚡', 'HKUST BEng Decision Analytics (2027) 🎓', '4 Yrs Tutoring | Edexcel & CAIE Boards ✍️']::text[]),
  ('MM-T102', 'MM-T102', NULL, ARRAY['Theatre HL', 'Chin B HL', 'Chin B SL', 'Math AA SL', 'ESS SL', 'IGCSE Chinese', 'IGCSE Physics', 'IGCSE Chemistry', 'IGCSE Biology', 'MYP Chinese', 'MYP Maths']::text[], 'Within Kowloon', ARRAY['To Kwa Wan', 'Sung Wong Toi', 'Kai Tak', 'Tsim Sha Tsui', 'Austin', 'Kowloon', 'Choi Hung']::text[], 300, NULL, true, NULL, ARRAY['English', 'Cantonese', 'Mandarin']::text[], '[]'::jsonb, 'either', 'female', NULL, ARRAY['IBDP', 'IGCSE', 'MYP']::text[], NULL, '[]'::jsonb, '{}'::text[], NULL, NULL, NULL, '{}'::text[])
ON CONFLICT (tutor_code) DO NOTHING;
