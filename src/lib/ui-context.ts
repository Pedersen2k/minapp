import { createContext, useContext } from 'react'

/** Gir oppgaveradene tilgang til å åpne detaljpanelet uten å sende funksjonen gjennom alle lag. */
export const OpenTaskContext = createContext<(id: string) => void>(() => {})
export const useOpenTask = () => useContext(OpenTaskContext)

/** Åpner redigeringsvinduene for prosjekter og etiketter fra hvor som helst. */
export const EditContext = createContext<{ editProject: (id: string) => void; editLabel: (name: string) => void }>({
  editProject: () => {},
  editLabel: () => {},
})
export const useEdit = () => useContext(EditContext)
