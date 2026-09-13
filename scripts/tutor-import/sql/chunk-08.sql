INSERT INTO public.tutors (tutor_code, display_name, headline, subjects, district, stations, hourly_rate, badge, is_published, experience_years, languages, exam_results, lesson_mode, gender, university, target_students, qualifications_summary, achievements, ia_ee_tok_support, ia_ee_tok_notes, academic_headline, secondary_school, card_highlights) VALUES
  ('MM-T038', 'MM-T038', 'IB 41/45 🏅 | CUHK Nursing Student 🩺 | Science & Math Specialist 🎯', ARRAY['Chem HL', 'Bio HL', 'Econ SL', 'Math AA SL']::text[], 'Within Hong Kong Island', '{}'::text[], 250, 'CUHK Nursing', true, NULL, ARRAY['English', 'Cantonese']::text[], '[{"system":"ib","subjects":[{"grade":"7","subject":"Chem HL"},{"grade":"7","subject":"Math AA SL"},{"grade":"7","subject":"Econ SL"},{"grade":"6","subject":"Bio HL"},{"grade":"6","subject":"Eng B HL"},{"grade":"6","subject":"Chin A Lang Lit SL"}]}]'::jsonb, 'either', 'male', 'CUHK', ARRAY['IBDP']::text[], '• **IB 41/45** with Grade 7 in Chemistry HL, Math AA SL & Economics SL 🏅

• Currently studying **BSc in Nursing at The Chinese University of Hong Kong (CUHK)** 🩺

• **IA feedback service:** structural review and guidance for Science and Math Internal Assessments 📝

• IBDP / Pre-IB coaching in Chemistry, Biology & Math AA with in-person (location flexible) or online lessons 💻', '[]'::jsonb, ARRAY['IA']::text[], NULL, 'IBDP 41/45', NULL, ARRAY['IB 41/45 | CUHK BSc Nursing 🩺', 'Chem HL, Math AA SL & Econ SL Grade 7 🧪➗', 'Science & Math IA feedback service 📝']::text[]),
  ('MM-T041', 'MM-T041', 'IB 40/45 🏅 | HKUST Mathematics 🔢 | Math AA HL Grade 7 Specialist 🎯', ARRAY['Math AA SL', 'Math AA HL']::text[], NULL, '{}'::text[], 700, 'HKUST Mathematics', true, 4, ARRAY['English', 'Cantonese']::text[], '[{"system":"ib","subjects":[{"grade":"7","subject":"Math AA HL"}]}]'::jsonb, 'online', NULL, 'HKUST', ARRAY['IBDP']::text[], '• **IB 40/45** with **Math AA HL Grade 7** ➗

• Currently pursuing a Bachelor''s degree in **Mathematics at The Hong Kong University of Science and Technology (HKUST)** 🔢

• **UKMT Senior Mathematical Challenge — Gold Certificate** 🎖️

• **4+ years of professional tutoring experience** specializing in international curricula; IBDP graduate (Class of 2018) 🏫

• Online Zoom lessons only 💻', '[]'::jsonb, '{}'::text[], NULL, 'IBDP 40/45', NULL, ARRAY['IB 40/45 | Math AA HL Grade 7 Specialist ➗', 'HKUST Mathematics Undergraduate 🔢', 'UKMT Senior Challenge Gold | 4+ Yrs Tutoring 🎖️']::text[]),
  ('MM-T043', 'MM-T043', 'HKU Materials Engineering 🔬 | A-Level 3A* (Math & Physics A*) 🎯 | SAT 1550/1600 📊', ARRAY['A-Level Physics', 'A-Level Mathematics']::text[], 'Within Kowloon', ARRAY['Ho Man Tin']::text[], 400, 'HKU Materials Engineering', true, 4, ARRAY['English']::text[], '[{"system":"alevel","subjects":[{"grade":"A*","subject":"Physics"},{"grade":"A*","subject":"Mathematics"}]},{"system":"sat","subjects":[{"grade":"1550","subject":"SAT Total"}]}]'::jsonb, 'either', NULL, 'HKU', ARRAY['A-Level']::text[], '• **GCE A-Level 3A\*** including Physics A* and Math A*; **SAT 1550/1600** 📊

• Currently majoring in **Materials Engineering at The University of Hong Kong (HKU)** 🔬

• Recipient of the prestigious **Hon Ping Full Scholarship to HKU** 🏆

• **4 years of extensive private tutoring** specializing in high-stakes public examinations and standardized test prep 🌟

• SAT comprehensive training (Math, Reading, Writing) plus advanced foundation support 📐', '[]'::jsonb, '{}'::text[], NULL, 'A-Level 3A* | SAT 1550', 'Galaxy International School', ARRAY['A-Level 3A* (Math & Physics) | SAT 1550 🏅', 'HKU Materials Engineering | Hon Ping Scholarship 🔬', '4 Yrs Exam & Standardized Test Tutoring 🌟']::text[]),
  ('MM-T044', 'MM-T044', 'IB Graduate | IB Psychology & IB Computer Science Specialist 🧠💻', ARRAY['Psych HL', 'Psych SL', 'Comp Sci SL']::text[], 'Within Hong Kong Island', '{}'::text[], 200, NULL, true, NULL, ARRAY['English']::text[], '[{"system":"ib","subjects":[{"grade":"6","subject":"Psych HL"},{"grade":"6","subject":"Comp Sci SL"},{"grade":"6","subject":"Econ HL"},{"grade":"6","subject":"Math AI SL"}]}]'::jsonb, 'either', 'male', NULL, ARRAY['IBDP', 'MYP']::text[], '• **IB 37/45** with Grade 6 in Psychology HL, Computer Science SL, Economics HL & Math AI SL; **EE Grade A** 📝

• Specialist focus with deep conceptual understanding of IB Psychology essay frameworks, case studies, and algorithm/pseudocode breakdowns 🧠

• Practical teaching experience delivering targeted lessons for Year 10 Economics students 🏫

• 100% English medium of instruction with custom study notes, structured guides, and practice resources 📚', '[]'::jsonb, ARRAY['EE']::text[], NULL, 'IBDP 37/45', NULL, ARRAY['IBDP Graduate | Psych HL & Comp Sci SL 6 🧠💻', 'Extended Essay Grade A 📝', '100% English instruction | Custom notes 📚']::text[])
ON CONFLICT (tutor_code) DO NOTHING;
