INSERT INTO public.tutors (tutor_code, display_name, headline, subjects, district, stations, hourly_rate, badge, is_published, experience_years, languages, exam_results, lesson_mode, gender, university, target_students, qualifications_summary, achievements, ia_ee_tok_support, ia_ee_tok_notes, academic_headline, secondary_school, card_highlights) VALUES
  ('MM-T029', 'MM-T029', NULL, '{}'::text[], NULL, '{}'::text[], 150, NULL, false, NULL, '{}'::text[], '[]'::jsonb, 'either', NULL, NULL, '{}'::text[], NULL, '[]'::jsonb, '{}'::text[], NULL, NULL, NULL, '{}'::text[]),
  ('MM-T030', 'MM-T030', 'CUHK Medicine (GPS) 🩺 | IB 44/45 | ESF Island School Graduate 🎯', ARRAY['Bio HL', 'Chem HL', 'Econ HL', 'Math AA SL', 'Eng A Lang Lit SL']::text[], 'Within Hong Kong Island', ARRAY['Sai Ying Pun']::text[], 300, 'CUHK Medicine (MBChB GPS)', false, 2, ARRAY['English', 'Cantonese']::text[], '[{"system":"ib","subjects":[{"grade":"7","subject":"Bio HL"},{"grade":"7","subject":"Chem HL"},{"grade":"7","subject":"Econ HL"},{"grade":"7","subject":"Math AA SL"},{"grade":"7","subject":"Eng A Lang Lit SL"},{"grade":"6","subject":"Spanish AB Initio SL"}]},{"system":"igcse","subjects":[{"grade":"9","subject":"Biology"},{"grade":"9","subject":"Chemistry"}]}]'::jsonb, 'either', 'male', 'CUHK', ARRAY['IBDP']::text[], '• **CUHK MBChB GPS (Global Physician-Leadership Stream)** — the highest entry-score medicine stream in Hong Kong 🩺

• **IB 44/45** with straight 7s in Biology HL & Chemistry HL across all internal assessments, plus Econ HL, Math AA SL & English A Lang Lit SL 🧬

• **IGCSE 8A* 1A** including Grade 9 in Biology and Chemistry; World Studies EE Grade A & TOK Grade A 📝

• CUHK Medical Entrance Scholarship; 2× Principal Medal for Academic Success; Islander Award & Spirit Award 🏆

• 2+ years of private tutoring and 4+ years as a school Science Mentor 👨‍🏫', '[]'::jsonb, ARRAY['EE', 'TOK']::text[], NULL, 'IBDP 44/45', 'ESF Island School', ARRAY['CUHK MBChB GPS (Global Physician-Leader) 🩺', 'IB 44/45 | Bio HL & Chem HL straight 7s 🧬🧪', 'IGCSE 8A* 1A | Principal Medal ×2 🏅']::text[]),
  ('MM-T031', 'MM-T031', 'IB 44/45 🏅 | CUHK Medicine (GPS) 🩺 | HL Bio & Chem Perfect 7s 🧬🧪', ARRAY['Chem HL', 'Bio HL']::text[], 'Within New Territories', ARRAY['Tsuen Wan']::text[], 350, 'CUHK Medicine (MBChB GPS)', true, 2, ARRAY['English', 'Cantonese']::text[], '[{"system":"ib","subjects":[{"grade":"7","subject":"Bio HL"},{"grade":"7","subject":"Chem HL"},{"grade":"7","subject":"Econ HL"},{"grade":"7","subject":"Math AA SL"},{"grade":"7","subject":"Eng A Lang Lit SL"},{"grade":"6","subject":"Spanish AB Initio SL"}]},{"system":"igcse","subjects":[{"grade":"9","subject":"Biology"},{"grade":"9","subject":"Chemistry"}]}]'::jsonb, 'either', 'female', 'CUHK', ARRAY['IBDP']::text[], '• **CUHK MBChB GPS** medical student; **IB 44/45** with Grade 7 in Biology HL, Chemistry HL, Economics HL, Math AA SL & English A Lang Lit SL 🏅

• **Consistency record:** straight 7s in every school test and internal assessment for HL Biology & HL Chemistry 📈

• **IGCSE 8A* 1A** including Grade 9 in Biology & Chemistry; World Studies EE Grade A; TOK Grade A 📝

• CUHK Medical Entrance Scholarship, 2× Principal Medal, Islander & Spirit Award 🏆

• 2+ years of tutoring plus 4+ years as an official school Science Mentor 👨‍🏫', '[]'::jsonb, ARRAY['EE']::text[], NULL, 'IBDP 44/45', 'ESF Island School', ARRAY['IB 44/45 | CUHK MBChB GPS 🩺', 'Straight 7s: Bio HL & Chem HL internals 📈', 'IGCSE 8A* 1A | 4+ Yrs Science Mentor 🧬']::text[]),
  ('MM-T033', 'MM-T033', 'SAT Math 800/800 Perfect Scorer ➗ | AP Calculus 5/5 📐 | HKUST Graduate & SOA Actuarial Credentials 🎓', ARRAY['AP Calculus AB', 'AP Calculus BC', 'Math AA HL', 'Math AA SL', 'Math AI HL', 'Math AI SL']::text[], 'Open to Discussion', '{}'::text[], 350, 'HKUST Graduate', true, NULL, ARRAY['English', 'Cantonese']::text[], '[{"system":"sat","subjects":[{"grade":"800","subject":"SAT Math"},{"grade":"1460","subject":"SAT Total"}]},{"system":"ap","subjects":[{"grade":"5","subject":"AP Calculus"},{"grade":"4","subject":"AP Chemistry"},{"grade":"4","subject":"AP Biology"}]}]'::jsonb, 'either', 'female', 'HKUST', ARRAY['AP', 'IBDP', 'A-Level', 'IGCSE']::text[], '• **SAT Math 800/800 perfect score** (SAT total 1460) with **AP Calculus 5/5** ➗📐

• **HKUST graduate** who has passed US Society of Actuaries exams: **Exam P (Probability), Exam FM (Financial Mathematics) & Exam SRM** 📊

• AP Chemistry (4/5) & AP Biology (4/5); high school GPA 3.54/4.00; Marshall School (Minnesota, USA) alumnus 🎓

• AP / SAT / IB / A-Level / IGCSE mathematics coaching from junior secondary to senior levels ➗', '[]'::jsonb, '{}'::text[], NULL, 'SAT Math 800/800 | AP Calculus 5/5', 'Marshall School (Minnesota, USA)', ARRAY['SAT Math 800/800 Perfect Score ➗', 'AP Calculus 5/5 | HKUST Graduate 📐🎓', 'SOA Exams Passed: P, FM & SRM 📊']::text[])
ON CONFLICT (tutor_code) DO NOTHING;
