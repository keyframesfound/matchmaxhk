INSERT INTO public.tutors (tutor_code, display_name, headline, subjects, district, stations, hourly_rate, badge, is_published, experience_years, languages, exam_results, lesson_mode, gender, university, target_students, qualifications_summary, achievements, ia_ee_tok_support, ia_ee_tok_notes, academic_headline, secondary_school, card_highlights) VALUES
  ('MM-T049', 'MM-T049', 'IB Math AI HL Grade 7 🔥 | SAT Math 790/800 🎓 | Math-English Double Major 🧠', ARRAY['Math AI HL', 'Math AI SL', 'Math AA SL']::text[], NULL, '{}'::text[], 100, NULL, true, NULL, ARRAY['English']::text[], '[{"system":"ib","subjects":[{"grade":"7","subject":"Math AI HL"}]},{"system":"sat","subjects":[{"grade":"790","subject":"SAT Math"}]}]'::jsonb, 'online', 'male', NULL, ARRAY['IBDP', 'MYP']::text[], '• **IB Math AI HL Grade 7** and **SAT Math 790/800** 🔥📊

• Double major in **Mathematics & English** — combining quantitative logic with precise language interpretation 🧠

• Trains IB mark-scheme structures for step-by-step method marks ✍️

• IB Math AI/AA (HL & SL) concept mastery, MYP foundations, and SAT Math strategy coaching ➗', '[]'::jsonb, '{}'::text[], NULL, 'IB Math AI HL: 7 | SAT Math 790', NULL, ARRAY['IB Math AI HL Grade 7 🔥', 'SAT Math 790/800 📊', 'Math & English Double Major 🧠']::text[]),
  ('MM-T050', 'MM-T050', 'HKDSE English 5* 🏅 | HKBU English Language & Literature 📚 | 5 Years International School Tutoring 👨‍🏫', ARRAY['English', 'English Literature', 'Primary English']::text[], 'Open to Discussion', ARRAY['Tung Chung', 'Central']::text[], 300, 'HKBU English Lang & Lit', true, 5, ARRAY['English', 'Cantonese']::text[], '[{"system":"dse","subjects":[{"grade":"5*","subject":"English Language"}]}]'::jsonb, 'either', 'female', 'HKBU', ARRAY['Primary', 'Secondary']::text[], '• **HKDSE English Language 5\***; current **HKBU English Language & Literature** undergraduate 📚

• **5 years of private tutoring** for elite international schools (ISF, ESF, FIS, CDNIS, Harrow, ProEd Global School Bali) 🌟

• **Educational consultant (1 yr 5 mo)** at Lee Educational Consulting: international school applications, MAP / CAT4 / AEAS prep, and interview training 💼

• 3-month teaching internship at Open Flow Learning Centre Bali; teaching assistant with Own Academy at Island School 🏫

• **2× champion of Around DB''s Young Writers'' Competition**; former YHKCC yearbook Chief Editor 🖋️', '[]'::jsonb, '{}'::text[], NULL, 'HKDSE English: 5*', 'YMCA of Hong Kong Christian College', ARRAY['DSE English 5* | HKBU Eng Lang & Lit 📚', '5 Yrs with ISF, ESF, FIS, CDNIS & Harrow 🌟', '2× Young Writers'' Competition Champion 🖋️']::text[]),
  ('MM-T051', 'MM-T051', 'IB Courses | HKMU Language Studies in English 📚 | Theatre HL: 6 | Duke of Edinburgh Gold 🎖️', ARRAY['Theatre HL', 'Primary English', 'Phonics']::text[], 'Within New Territories', ARRAY['Tung Chung']::text[], 100, 'HKMU Language Studies', true, NULL, ARRAY['English']::text[], '[{"system":"ib","subjects":[{"grade":"6","subject":"Theatre HL"}]},{"system":"sat","subjects":[{"grade":"1250","subject":"SAT Total"}]}]'::jsonb, 'either', 'female', 'Hong Kong Metropolitan University', ARRAY['Primary', 'MYP']::text[], '• **Theatre HL Grade 6** in IB Courses with Grade 6 across all MYP G10 subjects 🎭

• Currently studying **Language Studies in English at Hong Kong Metropolitan University (HKMU)** 📚

• **Duke of Edinburgh''s International Award (Gold)** 🎖️

• Certified in Youth Mental Health First Aid, St. John Ambulance First Aid, and a qualified kayaking instructor 🚣

• Part-time Educational Assistant at a primary school, dance instructor, and summer camp teacher 🌟', '[]'::jsonb, '{}'::text[], NULL, 'Theatre HL: 6 | IB Courses', NULL, ARRAY['Theatre HL 6 | Phonics & Primary English 🔤', 'Duke of Edinburgh Gold Award 🎖️', 'School Educational Assistant & Camp Teacher 🌟']::text[]),
  ('MM-T052', 'MM-T052', 'CityU Mechanical Engineering ⚙️ | A-Level 4A* 🎯 | Belt & Road & CityU Top Scholar 🏆', ARRAY['A-Level Mathematics', 'A-Level Physics', 'A-Level Chemistry', 'IGCSE Math', 'IGCSE Physics', 'IGCSE Chemistry', 'IGCSE Biology']::text[], 'Within Kowloon', ARRAY['Wong Tai Sin']::text[], 150, 'CityU Mechanical Engineering', true, 2, ARRAY['English']::text[], '[{"system":"alevel","subjects":[{"grade":"A*","subject":"Mathematics"},{"grade":"A*","subject":"Physics"},{"grade":"A*","subject":"Chemistry"},{"grade":"A*","subject":"Urdu"}]},{"system":"sat","subjects":[{"grade":"790","subject":"SAT Math"}]}]'::jsonb, 'either', 'male', 'CityU', ARRAY['A-Level', 'IGCSE']::text[], '• **GCE A-Level 4A\*** (Mathematics, Physics, Chemistry, Urdu) with **SAT Math 790/800** 🏅

• Current **Mechanical Engineering undergraduate at City University of Hong Kong (CityU)** ⚙️

• Recipient of the **HKSAR Belt and Road Scholarship & CityU Top Scholarship** 🌟

• **2+ years at Foryou Education** teaching IGCSE Math, Biology, Physics & Chemistry 🏫

• Olympiad mentorship: coached a 7-year-old to **Gold at AIMO and TIMO** 🥇', '[]'::jsonb, '{}'::text[], NULL, 'A-Level 4A* | SAT Math 790', 'Roots IVY Educational Complex Faisalabad', ARRAY['A-Level 4A* | SAT Math 790/800 🏅', 'CityU Mechanical Engineering ⚙️', 'Belt & Road + CityU Top Scholarship 🌟']::text[])
ON CONFLICT (tutor_code) DO NOTHING;
