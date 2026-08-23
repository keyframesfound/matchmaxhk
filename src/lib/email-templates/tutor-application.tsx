import * as React from 'react'

import {
  Body,
  Container,
  Head,
  Heading,
  Hr,
  Html,
  Preview,
  Text,
} from '@react-email/components'

import type { AnswerRow } from '@/lib/tutor-application.schema'

interface TutorApplicationEmailProps {
  applicantName: string
  rows: AnswerRow[]
}

export const TutorApplicationEmail = ({
  applicantName,
  rows,
}: TutorApplicationEmailProps) => (
  <Html lang="en" dir="ltr">
    <Head />
    <Preview>New tutor application — {applicantName}</Preview>
    <Body style={main}>
      <Container style={container}>
        <Heading style={h1}>New tutor application</Heading>
        <Text style={intro}>
          Submitted via the MatchMax tutor application page (/join).
        </Text>
        <Hr style={hr} />
        {rows.map((row) => (
          <div key={row.label} style={block}>
            <Text style={label}>{row.label}</Text>
            <Text style={value}>{row.value}</Text>
          </div>
        ))}
        <Hr style={hr} />
        <Text style={footer}>
          Reply directly to this email to reach the applicant.
        </Text>
      </Container>
    </Body>
  </Html>
)

export default TutorApplicationEmail

const main = { backgroundColor: '#f6f8fb', fontFamily: 'Arial, sans-serif' }
const container = { padding: '24px', backgroundColor: '#ffffff' }
const h1 = {
  fontSize: '20px',
  fontWeight: 'bold' as const,
  color: '#0b1f3a',
  margin: '0 0 8px',
}
const intro = { fontSize: '13px', color: '#55575d', margin: '0 0 12px' }
const hr = { borderColor: '#e4e8ef', margin: '12px 0' }
const block = { marginBottom: '12px' }
const label = {
  fontSize: '11px',
  textTransform: 'uppercase' as const,
  letterSpacing: '0.06em',
  color: '#7a8194',
  margin: '0 0 2px',
}
const value = {
  fontSize: '14px',
  color: '#0b1f3a',
  whiteSpace: 'pre-wrap' as const,
  margin: '0',
}
const footer = { fontSize: '12px', color: '#7a8194', margin: '0' }
