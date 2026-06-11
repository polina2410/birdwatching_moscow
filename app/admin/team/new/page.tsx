import { TeamMemberForm } from '@/components/admin/TeamMemberForm'

export default function NewTeamMemberPage() {
  return (
    <div>
      <h1 className="text-2xl font-bold mb-6">Добавить участника команды</h1>
      <TeamMemberForm />
    </div>
  )
}
